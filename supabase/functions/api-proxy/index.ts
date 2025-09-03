// Declaring the Deno global object resolves TypeScript errors in non-Deno environments
// and is a robust way to handle type checking for Supabase Edge Functions.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

// --- TTL CONSTANTS ---
const TTL_15_MINUTES = 15 * 60;
const TTL_6_HOURS = 6 * 60 * 60;
const TTL_60_DAYS = 60 * 24 * 60 * 60;
const MAX_ASSETS_FOR_ANALYSIS = 50; // Performance constraint

// --- TYPE DEFINITIONS ---
interface Asset {
  ticker: string; name: string; country: string; sector: string;
  asset_class: 'EQUITY' | 'CRYPTO' | 'BENCHMARK'; price?: number; is_shariah_compliant?: boolean;
}
interface PortfolioAsset extends Asset { weight: number; }
interface OptimizationResult {
    weights: PortfolioAsset[]; returns: number; volatility: number; sharpeRatio: number; currency?: string;
    warning?: string;
}
interface MCMCResult {
    simulations: { returns: number; volatility: number; sharpeRatio: number; }[];
    bestSharpe: OptimizationResult;
    averageWeights: PortfolioAsset[];
}
interface PriceDataPoint { date: string; price: number; }
interface Scenario { id: string; name: string; description: string; impact: Record<string, number>; }
interface BlackLittermanView {
    id: string;
    asset_ticker_1: string;
    direction: 'outperform' | 'underperform';
    asset_ticker_2: string;
    expected_return_diff: number;
    confidence: number;
}
interface ConstraintOptions {
    maxAssetWeight?: number;
    maxSectorWeight?: number;
}

// --- API & DB CLIENTS ---
const FMP_API_KEY = Deno.env.get("FMP_API_KEY");
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const AV_BASE_URL = 'https://www.alphavantage.co/query';
const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");

let supabaseAdmin: SupabaseClient;
try {
  supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` } } }
  );
} catch (e) {
  console.error("Failed to initialize Supabase admin client:", e.message);
}

// --- CENTRALIZED CACHING LOGIC ---
const withCache = async <T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> => {
  if (!supabaseAdmin) {
    console.warn("Supabase client not available, skipping cache and fetching live data for", key);
    return await fetcher();
  }
  
  const { data: cachedData, error: cacheError } = await supabaseAdmin
    .from('api_cache')
    .select('data, last_fetched')
    .eq('key', key)
    .single();

  if (cacheError && cacheError.code !== 'PGRST116') { // PGRST116 = 'Not found'
    console.error(`Cache read error for key ${key}:`, cacheError.message);
  }

  if (cachedData) {
    const isStale = new Date().getTime() - new Date(cachedData.last_fetched).getTime() > ttlSeconds * 1000;
    if (!isStale) {
      return cachedData.data as T;
    }
  }

  try {
      const liveData = await fetcher();
      if (liveData == null || (Array.isArray(liveData) && liveData.length === 0)) {
        if(cachedData) return cachedData.data as T; // Serve stale if live fails or returns empty
        throw new Error("Live fetch returned no data and no cache is available.");
      }
      const { error: upsertError } = await supabaseAdmin
        .from('api_cache')
        .upsert({ key, data: liveData, last_fetched: new Date().toISOString() });
    
      if (upsertError) {
        console.error(`Cache write error for key ${key}:`, upsertError.message);
      }
      return liveData;

  } catch (err) {
      console.error(`Live fetch failed for key ${key}: ${err.message}`);
      if (cachedData) {
          console.warn(`Serving stale data for ${key} due to fetch failure.`);
          return cachedData.data as T;
      }
      throw err; // Rethrow if no stale data is available
  }
};


// --- UTILITY & FORMATTING FUNCTIONS ---
const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`API error: ${res.status} ${errorBody.message || res.statusText} on URL: ${url}`);
    }
    const text = await res.text();
    if (url.includes('alphavantage.co')) {
        if (text.includes("Thank you for using Alpha Vantage!") || text.includes("Our standard API call frequency is")) {
            throw new Error("Alpha Vantage API rate limit reached or invalid call.");
        }
    }
    try {
        const jsonData = JSON.parse(text);
        if (jsonData['Error Message']) {
             throw new Error(`FMP API Error: ${jsonData['Error Message']}`);
        }
        return jsonData;
    } catch (e) {
        return text;
    }
}
const formatVolume = (vol: number | string) => {
    const numVol = Number(vol);
    if (isNaN(numVol) || !numVol) return 'N/A';
    if (numVol > 1_000_000) return `${(numVol / 1_000_000).toFixed(2)}M`;
    return `${(numVol / 1_000).toFixed(2)}K`;
};
const formatLargeNumber = (num: number | string) => {
    const numParsed = Number(num);
    if (isNaN(numParsed) || !numParsed) return 'N/A';
    if (Math.abs(numParsed) >= 1e9) return `${(numParsed / 1e9).toFixed(2)}B`;
    return `${(numParsed / 1e6).toFixed(2)}M`;
};

// --- MATRIX MATH HELPERS ---
const dot = (v1: number[], v2: number[]) => v1.reduce((sum, val, i) => sum + val * v2[i], 0);
const transpose = (matrix: number[][]) => matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
const multiply = (m1: number[][], m2: number[][]) => {
    const result: number[][] = Array(m1.length).fill(0).map(() => Array(m2[0].length).fill(0));
    for (let i = 0; i < m1.length; i++) {
        for (let j = 0; j < m2[0].length; j++) {
            for (let k = 0; k < m1[0].length; k++) {
                result[i][j] += m1[i][k] * m2[k][j];
            }
        }
    }
    return result;
}
const invert = (matrix: number[][]): number[][] => {
    const n = matrix.length;
    const identity = Array(n).fill(0).map((_, i) => Array(n).fill(0).map((__, j) => i === j ? 1 : 0));
    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

    for (let i = 0; i < n; i++) {
        let pivot = i;
        while (pivot < n && augmented[pivot][i] === 0) pivot++;
        if (pivot === n) throw new Error("Matrix is singular and cannot be inverted.");
        [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];

        const divisor = augmented[i][i];
        for (let j = i; j < 2 * n; j++) augmented[i][j] /= divisor;

        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = augmented[k][i];
                for (let j = i; j < 2 * n; j++) augmented[k][j] -= factor * augmented[i][j];
            }
        }
    }
    return augmented.map(row => row.slice(n));
};
const add = (m1: number[][], m2: number[][]): number[][] => m1.map((row, i) => row.map((val, j) => val + m2[i][j]));
const scale = (matrix: number[][], scalar: number): number[][] => matrix.map(row => row.map(val => val * scalar));


// --- STATIC DATA FALLBACKS ---
const staticData = {
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- NEW ASSET CLASS HELPERS ---
const KNOWN_CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL']);
const KNOWN_ETF_TICKERS = new Set(['SPY', 'QQQ', 'AGG', 'IEFA', 'GLD']);
const isCrypto = (ticker: string) => KNOWN_CRYPTO_TICKERS.has(ticker.toUpperCase());
const isEtf = (ticker: string) => KNOWN_ETF_TICKERS.has(ticker.toUpperCase());

// --- CORE FINANCIAL LOGIC ---
const getHistoricalDataForAssets = async (assets: Asset[]): Promise<{ returnsMatrix: number[][], meanReturns: number[], covMatrix: number[][], validAssets: Asset[] }> => {
    if (assets.length > MAX_ASSETS_FOR_ANALYSIS) {
        throw new Error(`Analysis is limited to ${MAX_ASSETS_FOR_ANALYSIS} assets to ensure performance. Please reduce the number of selected assets.`);
    }

    const historyPromises = assets.map(asset => handlers.getAssetPriceHistory({ ticker: asset.ticker }));
    const historyResults = await Promise.allSettled(historyPromises);

    const priceHistories: Record<string, PriceDataPoint[]> = {};
    const validAssets: Asset[] = [];
    historyResults.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.length > 252) { // Need at least 1 year of data
            priceHistories[assets[i].ticker] = res.value;
            validAssets.push(assets[i]);
        }
    });

    if (validAssets.length < 2) throw new Error("Insufficient historical data for at least two assets to perform analysis.");
    
    const dateMap: Map<string, Record<string, number>> = new Map();
    validAssets.forEach(asset => {
        priceHistories[asset.ticker].forEach(({ date, price }) => {
            if (!dateMap.has(date)) dateMap.set(date, {});
            dateMap.get(date)![asset.ticker] = price;
        });
    });

    const sortedDates = [...dateMap.keys()].sort();
    const alignedPrices: { date: string, prices: Record<string, number> }[] = [];
    for (const date of sortedDates) {
        const pricesOnDate = dateMap.get(date)!;
        if (validAssets.every(asset => pricesOnDate[asset.ticker] !== undefined)) {
            alignedPrices.push({ date, prices: pricesOnDate });
        }
    }
    const recentAlignedPrices = alignedPrices.slice(-504); // Use last ~2 years of data

    const dailyReturns: Record<string, number[]> = {};
    validAssets.forEach(asset => dailyReturns[asset.ticker] = []);
    for (let i = 1; i < recentAlignedPrices.length; i++) {
        validAssets.forEach(asset => {
            const prevPrice = recentAlignedPrices[i - 1].prices[asset.ticker];
            const currPrice = recentAlignedPrices[i].prices[asset.ticker];
            if (prevPrice > 0) {
                dailyReturns[asset.ticker].push((currPrice / prevPrice) - 1);
            }
        });
    }

    const returnsMatrix = validAssets.map(asset => dailyReturns[asset.ticker]);

    const meanReturns = returnsMatrix.map(returns => (returns.reduce((a, b) => a + b, 0) / returns.length) * 252);
    
    const numAssets = validAssets.length;
    const numReturns = dailyReturns[validAssets[0].ticker].length;
    const covMatrix: number[][] = Array(numAssets).fill(0).map(() => Array(numAssets).fill(0));
    
    for (let i = 0; i < numAssets; i++) {
        for (let j = i; j < numAssets; j++) {
            let covariance = 0;
            const mean_i = meanReturns[i] / 252;
            const mean_j = meanReturns[j] / 252;
            for (let k = 0; k < numReturns; k++) {
                covariance += (returnsMatrix[i][k] - mean_i) * (returnsMatrix[j][k] - mean_j);
            }
            covariance = (covariance / (numReturns - 1)) * 252;
            covMatrix[i][j] = covariance;
            covMatrix[j][i] = covariance;
        }
    }
    
    return { returnsMatrix, meanReturns, covMatrix, validAssets };
};

const calculatePortfolioMetrics = (weights: number[], meanReturns: number[], covMatrix: number[][]) => {
    const riskFreeRate = 0.042;
    const returns = dot(weights, meanReturns);
    const weightsTransposed = [weights];
    const covTimesWeights = multiply(covMatrix, transpose([weights]));
    const variance = multiply(weightsTransposed, covTimesWeights)[0][0];
    const volatility = Math.sqrt(Math.max(0, variance));
    const sharpeRatio = volatility > 0 ? (returns - riskFreeRate) / volatility : 0;
    return { returns, volatility, sharpeRatio };
};

// --- API HANDLERS ---
const handlers: Record<string, (payload: any) => Promise<any>> = {
  getAvailableAssets: async () => withCache('available-assets', async () => {
    // FMP-FIRST STRATEGY
    try {
        console.log("Attempting to fetch asset list from FMP Screener (free-tier friendly)...");
        const url = `${FMP_BASE_URL}/stock-screener?marketCapMoreThan=10000000000&country=US&limit=2000&apikey=${FMP_API_KEY}`;
        const fmpAssetsData = await apiFetch(url);

        if (!Array.isArray(fmpAssetsData) || fmpAssetsData.length < 100) {
            throw new Error(`FMP screener returned too few assets: ${fmpAssetsData.length || 0}`);
        }

        const fmpAssets: Asset[] = fmpAssetsData.map(s => ({
            ticker: s.symbol,
            name: s.companyName,
            country: 'US',
            asset_class: 'EQUITY',
            sector: s.sector || 'Miscellaneous',
            price: s.price,
            is_shariah_compliant: false
        }));

        const supplementalAssets: Asset[] = [
            { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
            { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
            { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
            { ticker: 'SPY', name: 'SPDR S&P 500 ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'Index ETF' },
            { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', asset_class: 'BENCHMARK', sector: 'Index ETF' },
            { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'Fixed Income ETF' },
            { ticker: 'GLD', name: 'SPDR Gold Shares', country: 'US', asset_class: 'BENCHMARK', sector: 'Commodity ETF' },
            { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'International Equity ETF' },
        ];
        
        console.log(`Successfully fetched ${fmpAssets.length} assets from FMP.`);
        return { assets: [...fmpAssets, ...supplementalAssets] };

    } catch (fmpError) {
        console.warn(`FMP failed for asset list, falling back to Alpha Vantage. Error: ${fmpError.message}`);
        
        // ALPHA VANTAGE FALLBACK
        try {
            const url = `${AV_BASE_URL}?function=LISTING_STATUS&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const csvText = await apiFetch(url);
            if (typeof csvText !== 'string' || !csvText.includes('symbol,name,exchange')) {
                throw new Error("Invalid CSV response from Alpha Vantage listing status.");
            }
            
            const lines = csvText.split('\n').slice(1);
            const avAssets: Asset[] = lines.map(line => {
                const parts = line.split(',');
                if (parts.length < 4) return null;
                const [symbol, name, exchange, assetType] = parts.map(v => v.replace(/"/g, ''));

                if (assetType === 'Stock' && ['NYSE', 'NASDAQ'].includes(exchange)) {
                    return { ticker: symbol, name: name, country: 'US', asset_class: 'EQUITY', sector: 'Unknown' };
                }
                return null;
            }).filter((a): a is Asset => a !== null);
            
            if (avAssets.length < 1000) throw new Error(`Alpha Vantage returned too few assets: ${avAssets.length}.`);

            console.log(`Successfully fetched ${avAssets.length} assets from Alpha Vantage as fallback.`);
            return { assets: avAssets };

        } catch (avError) {
            console.error(`Both FMP and Alpha Vantage failed for asset list. Error: ${avError.message}. Serving static fallback.`);
            const expandedStaticAssets: Asset[] = [
                { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY' },
                { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY' },
                { ticker: 'GOOGL', name: 'Alphabet Inc.', country: 'US', sector: 'Communication Services', asset_class: 'EQUITY' },
                { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY' },
                { ticker: 'NVDA', name: 'NVIDIA Corporation', country: 'US', sector: 'Technology', asset_class: 'EQUITY' },
                { ticker: 'TSLA', name: 'Tesla, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY' },
                { ticker: 'JPM', name: 'JPMorgan Chase & Co.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY' },
                { ticker: 'V', name: 'Visa Inc.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY' },
                { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY' },
                { ticker: 'UNH', name: 'UnitedHealth Group', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY' },
                { ticker: 'WMT', name: 'Walmart Inc.', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY' },
                { ticker: 'PG', name: 'Procter & Gamble Co.', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY' },
                { ticker: 'XOM', name: 'Exxon Mobil Corp.', country: 'US', sector: 'Energy', asset_class: 'EQUITY' },
                { ticker: 'SPY', name: 'SPDR S&P 500 ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'Index ETF' },
                { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', asset_class: 'BENCHMARK', sector: 'Index ETF' },
                { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'Fixed Income ETF' },
                { ticker: 'GLD', name: 'SPDR Gold Shares', country: 'US', asset_class: 'BENCHMARK', sector: 'Commodity ETF' },
                { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF', country: 'US', asset_class: 'BENCHMARK', sector: 'International Equity ETF' },
                { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
                { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
                { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' },
            ];
            return { assets: expandedStaticAssets };
        }
    }
  }, TTL_6_HOURS),

  getAssetPriceHistory: async ({ ticker }) => withCache(`price-history-${ticker}`, async () => {
    const isCryptoAsset = isCrypto(ticker);
    const fmpTicker = isCryptoAsset ? `${ticker}USD` : ticker;
    const fmpUrl = isCryptoAsset 
        ? `${FMP_BASE_URL}/historical-price-full/crypto/${fmpTicker}?apikey=${FMP_API_KEY}`
        : `${FMP_BASE_URL}/historical-price-full/${fmpTicker}?apikey=${FMP_API_KEY}`;
    
    try {
        const data = await apiFetch(fmpUrl);
        const history = (data?.historical || data || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
        if (history.length === 0) throw new Error("FMP returned no history.");
        return history;
    } catch (fmpError) {
        console.warn(`FMP history failed for ${ticker}, falling back to AV. Error: ${fmpError.message}`);
        const avFunction = isCryptoAsset ? 'DIGITAL_CURRENCY_DAILY' : 'TIME_SERIES_DAILY_ADJUSTED';
        const avUrl = `${AV_BASE_URL}?function=${avFunction}&symbol=${ticker}${isCryptoAsset ? '&market=USD' : ''}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const data = await apiFetch(avUrl);
        const timeSeriesKey = isCryptoAsset ? 'Time Series (Digital Currency Daily)' : 'Time Series (Daily)';
        const priceKey = isCryptoAsset ? '4a. close (USD)' : '4. close';
        const timeSeries = data[timeSeriesKey];
        if (!timeSeries) throw new Error(`Invalid AV response for ${ticker}`);
        return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
            date, price: parseFloat(values[priceKey])
        })).reverse();
    }
  }, TTL_6_HOURS),
  
  getAssetPriceSummary: async ({ ticker }) => withCache(`price-summary-${ticker}`, async () => {
    const isCryptoAsset = isCrypto(ticker);
    const apiTicker = isCryptoAsset ? `${ticker}USD` : ticker;
    try {
        const data = await apiFetch(`${FMP_BASE_URL}/quote/${apiTicker}?apikey=${FMP_API_KEY}`);
        const quote = data[0] || {};
        if (!quote.price) throw new Error("FMP returned no quote data.");
        return { open: quote.open ?? 0, close: quote.price ?? 0, high: quote.dayHigh ?? 0, low: quote.dayLow ?? 0, volume: formatVolume(quote.volume) };
    } catch (fmpError) {
        console.warn(`FMP quote failed for ${ticker}, falling back to AV. Error: ${fmpError.message}`);
        const url = `${AV_BASE_URL}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const data = await apiFetch(url);
        const quote = data['Global Quote'];
        if (!quote || Object.keys(quote).length === 0 || !quote['05. price']) throw new Error(`AV returned no quote data for ${ticker}`);
        return { open: parseFloat(quote['02. open']), close: parseFloat(quote['05. price']), high: parseFloat(quote['03. high']), low: parseFloat(quote['04. low']), volume: formatVolume(quote['06. volume']) };
    }
  }, TTL_15_MINUTES),

  getFinancialRatios: async ({ ticker }) => {
    if (isCrypto(ticker) || isEtf(ticker)) {
        return [];
    }
    return withCache(`ratios-${ticker}`, async () => {
        const data = await apiFetch(`${AV_BASE_URL}?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        if (!data.Symbol) return [];
        const ratios = [
            { label: 'P/E (TTM)', value: data.PERatio }, { label: 'P/B', value: data.PriceToBookRatio },
            { label: 'Dividend Yield', value: data.DividendYield ? `${(parseFloat(data.DividendYield) * 100).toFixed(2)}%` : 'N/A' },
            { label: 'Market Cap', value: formatLargeNumber(data.MarketCapitalization) },
            { label: 'EPS (TTM)', value: data.EPS }, { label: 'Beta', value: data.Beta }
        ];
        return ratios.map(r => ({ ...r, value: r.value ?? 'N/A' })).filter(r => r.value !== 'N/A');
    }, TTL_60_DAYS);
  },

  getFinancialsSnapshot: async ({ ticker }) => {
     if (isCrypto(ticker) || isEtf(ticker)) {
        return { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' };
    }
    return withCache(`financials-${ticker}`, async () => {
        const results = await Promise.allSettled([
            apiFetch(`${AV_BASE_URL}?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`),
            apiFetch(`${AV_BASE_URL}?function=BALANCE_SHEET&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`),
        ]);
        const incomeData = results[0].status === 'fulfilled' ? results[0].value.annualReports?.[0] : {};
        const balanceData = results[1].status === 'fulfilled' ? results[1].value.annualReports?.[0] : {};
        return {
            income: [{ metric: 'Revenue', value: formatLargeNumber(incomeData?.totalRevenue) }, { metric: 'Net Income', value: formatLargeNumber(incomeData?.netIncome) }],
            balanceSheet: [{ metric: 'Total Assets', value: formatLargeNumber(balanceData?.totalAssets) }, { metric: 'Total Liabilities', value: formatLargeNumber(balanceData?.totalLiabilities) }],
            cashFlow: [],
            asOf: incomeData?.fiscalDateEnding || 'N/A'
        };
    }, TTL_60_DAYS);
  },

  getCompanyProfile: async ({ ticker }) => withCache(`profile-${ticker}`, async () => {
    try {
        const data = await apiFetch(`${AV_BASE_URL}?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        if (!data.Description) throw new Error("No description in profile from AV.");
        return { description: data.Description, beta: parseFloat(data.Beta) };
    } catch(e) {
        console.warn(`Could not fetch company profile for ${ticker}: ${e.message}. Returning generic info.`);
        return { description: 'Detailed company profile is currently unavailable for this asset.', beta: null };
    }
  }, TTL_60_DAYS),

  getDividendInfo: async ({ ticker }) => withCache(`dividend-${ticker}`, async () => {
     const data = await apiFetch(`${AV_BASE_URL}?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`);
     if (!data.DividendYield || parseFloat(data.DividendYield) === 0) return null;
     return { 
        ticker, 
        yield: parseFloat(data.DividendYield), 
        amountPerShare: parseFloat(data.DividendPerShare), 
        payDate: data.DividendDate, 
        projectedAnnualIncome: 0 
    };
  }, TTL_60_DAYS),

  getMarketNews: async () => withCache('market-news', async () => {
    try {
        const data = await apiFetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`);
        return (data.articles || []).map((a: any) => ({ title: a.title, source: a.source.name, summary: a.description, url: a.url }));
    } catch (e) {
        console.warn("News API failed, returning static news.", e.message);
        return staticData.news;
    }
  }, 3600),

  getFxRate: async ({ from, to }) => {
      const rates = staticData.fxRates;
      const rate = (rates[to] || 1) / (rates[from] || 1);
      return rate;
  },
  getRiskFreeRate: async() => {
    return 0.042;
  },

  calculatePortfolioMetricsFromCustomWeights: async({ assets, weights, currency }) => {
    const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(assets);
    const weightVector = validAssets.map(a => (weights[a.ticker] || 0) / 100);
    const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weightVector, meanReturns, covMatrix);
    return {
        weights: validAssets.map((a, i) => ({ ...a, weight: weightVector[i] })),
        returns, volatility, sharpeRatio, currency
    };
  },
  generateAndOptimizePortfolio: async ({ template, optimizationModel, runner, currency, constraints }) => {
    const { assets: availableAssets } = await handlers.getAvailableAssets({});
    
    try {
        let selectedAssets: Asset[] = [];
        
        switch (template) {
            case 'Aggressive':
                const aggressiveTickers = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'NVDA', 'BTC', 'ETH', 'SOL'];
                selectedAssets = availableAssets.filter(a => aggressiveTickers.includes(a.ticker));
                if (selectedAssets.length < 5) throw new Error("Could not find enough aggressive assets in the available list.");
                break;

            case 'Shariah':
                const shariahTickers = ['AAPL', 'MSFT', 'JNJ', 'PG', 'HD', 'XOM', 'ADBE'];
                selectedAssets = availableAssets.filter(a => shariahTickers.includes(a.ticker));
                if (selectedAssets.length < 3) throw new Error("Could not find enough known Shariah-compliant assets.");
                break;
            
            case 'Balanced':
            default:
                const balancedTickers = ['SPY', 'AGG', 'GLD', 'IEFA'];
                selectedAssets = availableAssets.filter((a: Asset) => balancedTickers.includes(a.ticker));
                if (selectedAssets.length < 2) {
                     selectedAssets = availableAssets.filter((a: Asset) => ['AAPL', 'JNJ', 'PG'].includes(a.ticker));
                }
                break;
        }
        
        if (selectedAssets.length < 2) throw new Error(`Template '${template}' resulted in fewer than 2 valid assets.`);
        
        const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(selectedAssets);
        let simulations, bestSharpePortfolio, minVolatilityPortfolio;
        try {
            simulations = [];
            bestSharpePortfolio = { sharpeRatio: -Infinity, weights: [], returns: 0, volatility: 0 };
            minVolatilityPortfolio = { volatility: Infinity, weights: [], returns: 0, sharpeRatio: 0 };
            for (let i = 0; i < 7500; i++) {
                const rand = Array.from({ length: validAssets.length }, () => Math.random());
                const total = rand.reduce((a, b) => a + b, 0);
                if (total === 0) continue;
                let weights = rand.map(r => r / total);
                const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weights, meanReturns, covMatrix);
                simulations.push({ returns, volatility, sharpeRatio });
                if (sharpeRatio > bestSharpePortfolio.sharpeRatio) bestSharpePortfolio = { returns, volatility, sharpeRatio, weights };
                if (volatility < minVolatilityPortfolio.volatility) minVolatilityPortfolio = { returns, volatility, sharpeRatio, weights };
            }
        } catch (mathError) {
            if (mathError.message.includes("Matrix is singular")) throw new Error("Optimization failed. The selected assets are too similar (highly correlated). Please try a more diverse set of assets.");
            throw mathError;
        }
        const optimal = optimizationModel === 'Minimize Volatility' ? minVolatilityPortfolio : bestSharpePortfolio;
        const bestSharpeResult: OptimizationResult = {
            weights: validAssets.map((a, i) => ({ ...a, weight: optimal.weights[i] })),
            returns: optimal.returns, volatility: optimal.volatility, sharpeRatio: optimal.sharpeRatio, currency: currency || 'USD'
        };
        return { bestSharpe: bestSharpeResult, simulations, averageWeights: bestSharpeResult.weights };
    } catch (error) {
        console.warn(`Analysis failed for template '${template}', generating fallback. Reason: ${error.message}`);
        const fallbackAssets = availableAssets.filter((a: Asset) => ['SPY', 'AGG'].includes(a.ticker));
        const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(fallbackAssets);
        if (validAssets.length < 2) throw new Error("Could not generate a fallback portfolio. Core data sources might be down.");
        const weightsMap: Record<string, number> = {'SPY': 0.6, 'AGG': 0.4};
        const fallbackWeights = validAssets.map(a => weightsMap[a.ticker] || 0);
        const metrics = calculatePortfolioMetrics(fallbackWeights, meanReturns, covMatrix);
        const result: OptimizationResult = {
            weights: validAssets.map((a, i) => ({ ...a, weight: fallbackWeights[i] })), ...metrics, currency: currency || 'USD',
            warning: `Analysis for the '${template}' template failed due to lack of asset data. A balanced fallback portfolio (SPY/AGG) has been generated instead.`
        };
        return { bestSharpe: result, simulations: [], averageWeights: result.weights };
    }
  },
  
  runBlackLittermanOptimization: async ({ assets, views, currency }: { assets: Asset[], views: BlackLittermanView[], currency: string }) => {
    const { covMatrix, validAssets } = await getHistoricalDataForAssets(assets);
    if (validAssets.length < 2) throw new Error("Black-Litterman requires at least two assets with sufficient historical data.");
    const riskAversion = 2.5; const tau = 0.05;
    const equalWeights = Array(validAssets.length).fill(1 / validAssets.length);
    const equilibriumReturns = scale(multiply(covMatrix, transpose([equalWeights])), riskAversion)[0];
    const numAssets = validAssets.length; const numViews = views.length;
    const P = Array(numViews).fill(0).map(() => Array(numAssets).fill(0));
    const Q = views.map(view => view.expected_return_diff);
    const assetIndexMap = new Map(validAssets.map((asset, i) => [asset.ticker, i]));
    views.forEach((view, i) => {
        const index1 = assetIndexMap.get(view.asset_ticker_1);
        const index2 = assetIndexMap.get(view.asset_ticker_2);
        if (index1 !== undefined) P[i][index1] = view.direction === 'outperform' ? 1 : -1;
        if (index2 !== undefined) P[i][index2] = view.direction === 'outperform' ? -1 : 1;
    });
    const P_tauSigma_PT = multiply(P, multiply(scale(covMatrix, tau), transpose(P)));
    const Omega = P_tauSigma_PT.map((row, i) => row.map((val, j) => (i === j ? val / (views[i].confidence || 0.5) : 0)));
    const tauSigmaInv = invert(scale(covMatrix, tau)); const OmegaInv = invert(Omega);
    const term1_inv = add(tauSigmaInv, multiply(transpose(P), multiply(OmegaInv, P)));
    const term1 = invert(term1_inv);
    const term2 = add(multiply(tauSigmaInv, transpose([equilibriumReturns])), multiply(transpose(P), multiply(OmegaInv, transpose([Q]))));
    const posteriorReturns = transpose(multiply(term1, term2))[0];
    const simulations = []; let bestSharpePortfolio = { sharpeRatio: -Infinity, weights: [], returns: 0, volatility: 0 };
    for (let i = 0; i < 7500; i++) {
        const rand = Array.from({ length: numAssets }, () => Math.random());
        const total = rand.reduce((a, b) => a + b, 0); if (total === 0) continue;
        const weights = rand.map(r => r / total);
        const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weights, posteriorReturns, covMatrix);
        simulations.push({ returns, volatility, sharpeRatio });
        if (sharpeRatio > bestSharpePortfolio.sharpeRatio) bestSharpePortfolio = { returns, volatility, sharpeRatio, weights };
    }
    const bestSharpeResult: OptimizationResult = {
        weights: validAssets.map((a, i) => ({ ...a, weight: bestSharpePortfolio.weights[i] })),
        returns: bestSharpePortfolio.returns, volatility: bestSharpePortfolio.volatility, sharpeRatio: bestSharpePortfolio.sharpeRatio, currency: currency || 'USD'
    };
    return { bestSharpe: bestSharpeResult, simulations, averageWeights: bestSharpeResult.weights };
  },

  runBacktest: async({ portfolio, timeframe, benchmarkTicker }) => { return { dates: [], portfolioValues: [], benchmarkValues: [], totalReturn: 0.1, benchmarkReturn: 0.08, maxDrawdown: -0.05 }; },
  getCorrelationMatrix: async({ assets }) => { 
      try {
        const { covMatrix, validAssets } = await getHistoricalDataForAssets(assets);
        const stdevs = covMatrix.map((row, i) => Math.sqrt(row[i]));
        const corrMatrix = covMatrix.map((row, i) => row.map((cell, j) => stdevs[i] > 0 && stdevs[j] > 0 ? cell / (stdevs[i] * stdevs[j]) : 0));
        return { assets: validAssets.map(a => a.ticker), matrix: corrMatrix };
      } catch (e) {
          return { assets: [], matrix: [] };
      }
  },
  getRiskReturnContribution: async ({ portfolio }) => {
    try {
        const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
        const weights = validAssets.map(a => portfolio.weights.find(w => w.ticker === a.ticker)?.weight || 0);
        const { returns: portfolioReturns, volatility: portfolioVolatility } = calculatePortfolioMetrics(weights, meanReturns, covMatrix);
        const contributions = validAssets.map((asset, i) => {
            const marginalContribution = dot(weights, covMatrix[i]) * weights[i];
            const riskContribution = portfolioVolatility > 0 ? marginalContribution / portfolioVolatility**2 : 0;
            const returnContribution = portfolioReturns > 0 ? (weights[i] * meanReturns[i]) / portfolioReturns : 0;
            return { ticker: asset.ticker, returnContribution: isFinite(returnContribution) ? returnContribution : 0, riskContribution: isFinite(riskContribution) ? riskContribution : 0 };
        });
        return contributions;
    } catch(e) {
        console.error("Risk/Return contribution calc failed:", e.message);
        return [];
    }
  },
  runScenarioAnalysis: async ({ portfolio, scenario }: { portfolio: OptimizationResult, scenario: Scenario }) => {
    const { meanReturns, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
    const weights = validAssets.map(a => portfolio.weights.find(w=>w.ticker===a.ticker)!.weight);
    const originalReturn = dot(weights, meanReturns);
    const scenarioReturns = meanReturns.map((ret, i) => ret * (scenario.impact[validAssets[i].sector] || 1));
    const scenarioPortfolioReturn = dot(weights, scenarioReturns);
    return { originalReturn, scenarioReturn: scenarioPortfolioReturn, impactPercentage: (scenarioPortfolioReturn / originalReturn) - 1 };
  },
  runFactorAnalysis: async ({ portfolio }) => {
    return { beta: 1.1, smb: 0.2, hml: -0.1 };
  },
  calculateVaR: async ({ portfolio }) => {
    const { returnsMatrix, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
    const weights = validAssets.map(a => portfolio.weights.find(w => w.ticker === a.ticker)?.weight || 0);
    const portfolioDailyReturns = transpose(returnsMatrix).map(dailyReturns => dot(weights, dailyReturns));
    portfolioDailyReturns.sort((a, b) => a - b);
    const varIndex = Math.floor(portfolioDailyReturns.length * 0.05);
    const var95 = -portfolioDailyReturns[varIndex] * 10000;
    const cvar95 = -portfolioDailyReturns.slice(0, varIndex).reduce((a,b)=>a+b,0) / varIndex * 10000;
    return { var95, cvar95, portfolioValue: 10000 };
  },
  simulateTaxLossHarvesting: async({ portfolio }) => {
      return { candidates: [], potentialTaxSavings: 0 };
  },
  generateRebalancePlan: async({ currentPortfolio, targetWeights }) => {
      return [];
  },
  getOptionChain: async({ ticker, date }) => withCache(`options-${ticker}-${date}`, async() => {
      const data = await apiFetch(`${FMP_BASE_URL}/options-chain/${ticker}?expirationDate=${date}&apikey=${FMP_API_KEY}`);
      return (data || []).map((o: any) => ({ expirationDate: o.expirationDate, strikePrice: o.strike, lastPrice: o.lastPrice, type: o.optionType }));
  }, TTL_6_HOURS)
};

// --- MAIN SERVER ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { command, payload } = await req.json();
    if (!handlers[command]) {
      throw new Error(`Command not found: ${command}`);
    }
    const result = await handlers[command](payload);
    
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } catch (error) {
    console.error(`Error processing command:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

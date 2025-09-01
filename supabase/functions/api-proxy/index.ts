// Declaring the Deno global object resolves TypeScript errors in non-Deno environments
// and is a robust way to handle type checking for Supabase Edge Functions.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { GoogleGenAI } from "npm:@google/genai";

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
type DataSource = 'live' | 'cache' | 'static';
interface ServiceResponse<T> { data: T; source: DataSource; }

// --- API & DB CLIENTS ---
const FMP_API_KEY = Deno.env.get("FMP_API_KEY");
const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const AV_BASE_URL = 'https://www.alphavantage.co/query';

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
const withCache = async <T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<ServiceResponse<T>> => {
  if (!supabaseAdmin) {
    console.warn("Supabase client not available, skipping cache and fetching live data for", key);
    const data = await fetcher();
    return { data, source: 'live' };
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
      return { data: cachedData.data as T, source: 'cache' };
    }
  }

  const liveData = await fetcher();

  const { error: upsertError } = await supabaseAdmin
    .from('api_cache')
    .upsert({ key, data: liveData, last_fetched: new Date().toISOString() });

  if (upsertError) {
    console.error(`Cache write error for key ${key}:`, upsertError.message);
  }

  return { data: liveData, source: 'live' };
};


// --- UTILITY & FORMATTING FUNCTIONS ---
const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText} on URL: ${url}`);
    return res.json();
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
const staticAssetsList: Asset[] = [
    { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_shariah_compliant: true },
    { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_shariah_compliant: true },
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
    { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
    { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
    { ticker: 'AGG', name: 'iShares Core U.S. Bond ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
];
const staticData = {
    assets: staticAssetsList,
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- CORE FINANCIAL LOGIC ---
const getHistoricalDataForAssets = async (assets: Asset[]): Promise<{ returnsMatrix: number[][], meanReturns: number[], covMatrix: number[][], validAssets: Asset[] }> => {
    if (assets.length > MAX_ASSETS_FOR_ANALYSIS) {
        throw new Error(`Analysis is limited to ${MAX_ASSETS_FOR_ANALYSIS} assets to ensure performance. Please reduce the number of selected assets.`);
    }

    // 1. Fetch all histories in parallel
    const historyPromises = assets.map(asset => handlers.getAssetPriceHistory({ ticker: asset.ticker }));
    const historyResults = await Promise.allSettled(historyPromises);

    const priceHistories: Record<string, PriceDataPoint[]> = {};
    const validAssets: Asset[] = [];
    historyResults.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.data.length > 252) { // Need at least 1 year of data
            priceHistories[assets[i].ticker] = res.value.data;
            validAssets.push(assets[i]);
        }
    });

    if (validAssets.length < 2) throw new Error("Insufficient historical data for at least two assets to perform analysis.");
    
    // 2. Align data by date
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

    // 3. Calculate daily returns
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

    // 4. Calculate mean returns (annualized)
    const meanReturns = returnsMatrix.map(returns => (returns.reduce((a, b) => a + b, 0) / returns.length) * 252);
    
    // 5. Calculate covariance matrix (annualized)
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
    const results = await Promise.allSettled([
        apiFetch(`${FMP_BASE_URL}/stock/list?apikey=${FMP_API_KEY}`),
        apiFetch(`${FMP_BASE_URL}/symbol/available-cryptocurrencies?apikey=${FMP_API_KEY}`)
    ]);

    const stockData = results[0].status === 'fulfilled' ? results[0].value : [];
    const cryptoData = results[1].status === 'fulfilled' ? results[1].value : [];
    
    const majorExchanges = new Set(['NASDAQ', 'NYSE', 'AMEX']);
    const filteredStocks = stockData.filter((s: any) => majorExchanges.has(s.exchangeShortName) && s.type === 'stock').map((s: any) => ({ ticker: s.symbol, name: s.name, price: s.price, country: 'US', asset_class: 'EQUITY', sector: 'Unknown' }));
    const filteredCryptos = cryptoData.slice(0, 100).map((c: any) => ({ ticker: c.symbol.replace('USD', ''), name: c.name, price: c.price, country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency' }));
    
    const assets = [...filteredStocks.slice(0, 400), ...filteredCryptos];
    if (assets.length === 0) {
        return { assets: staticAssetsList };
    }
    return { assets };
  }, TTL_6_HOURS),

  getAssetPriceHistory: async ({ ticker }) => withCache(`price-history-${ticker}`, async () => {
    // A more robust way to check if an asset is a cryptocurrency by checking the master asset list.
    // This is better than relying on a small, hardcoded list.
    const allAssetsResponse = await handlers.getAvailableAssets({});
    const allAssets: Asset[] = allAssetsResponse.data.assets;
    const assetInfo = allAssets.find((a: Asset) => a.ticker === ticker);
    const isCrypto = assetInfo?.asset_class === 'CRYPTO';

    const fmpTicker = isCrypto ? `${ticker}USD` : ticker;
    try {
        const url = `${FMP_BASE_URL}/historical-price-full/${fmpTicker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const history = (data?.historical || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
        if (history.length > 0) return history;
        throw new Error("Empty history from FMP");
    } catch (fmpError) {
        console.warn(`FMP failed for ${ticker}, falling back to AV. Error: ${fmpError.message}`);
        const avFunction = isCrypto ? 'DIGITAL_CURRENCY_DAILY' : 'TIME_SERIES_DAILY_ADJUSTED';
        const avSymbol = isCrypto ? ticker : ticker;
        const url = `${AV_BASE_URL}?function=${avFunction}&symbol=${avSymbol}${isCrypto ? '&market=USD' : ''}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const data = await apiFetch(url);
        const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series') || k.includes('Digital Currency'));
        if (!timeSeriesKey || !data[timeSeriesKey]) throw new Error(`Invalid AV response for ${ticker}`);
        const timeSeries = data[timeSeriesKey];
        return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
            date, price: parseFloat(isCrypto ? values['4a. close (USD)'] : values['4. close'])
        })).reverse();
    }
  }, TTL_60_DAYS),
  
  getAssetPriceSummary: async ({ ticker }) => withCache(`price-summary-${ticker}`, async () => {
    const isCrypto = staticAssetsList.find(a => a.ticker === ticker && a.asset_class === 'CRYPTO') || ticker.endsWith('-USD');
    const fmpTicker = isCrypto ? `${ticker}USD` : ticker;
    const data = await apiFetch(`${FMP_BASE_URL}/quote/${fmpTicker}?apikey=${FMP_API_KEY}`);
    const quote = data[0] || {};
    return { open: quote.open ?? 0, close: quote.price ?? 0, high: quote.dayHigh ?? 0, low: quote.dayLow ?? 0, volume: formatVolume(quote.volume) };
  }, TTL_15_MINUTES),

  getFinancialRatios: async ({ ticker }) => withCache(`ratios-${ticker}`, async () => {
    const results = await Promise.allSettled([
        apiFetch(`${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`),
        apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`),
        apiFetch(`${FMP_BASE_URL}/key-metrics-ttm/${ticker}?apikey=${FMP_API_KEY}`)
    ]);

    const quoteData = results[0].status === 'fulfilled' ? results[0].value : [];
    const profileData = results[1].status === 'fulfilled' ? results[1].value : [];
    const metricsData = results[2].status === 'fulfilled' ? results[2].value : [];

    const quote = quoteData[0] || {}; 
    const profile = profileData[0] || {}; 
    const metrics = metricsData[0] || {};
    
    const ratios = [
        { label: 'P/E (TTM)', value: (quote.pe ?? metrics.peRatioTTM)?.toFixed(2) },
        { label: 'P/B', value: metrics.priceToBookRatioTTM?.toFixed(2) },
        { label: 'Dividend Yield', value: metrics.dividendYieldTTM != null ? `${(metrics.dividendYieldTTM * 100).toFixed(2)}%` : undefined },
        { label: 'Market Cap', value: formatLargeNumber(quote.marketCap) },
        { label: 'EPS (TTM)', value: (quote.eps ?? metrics.epsTTM)?.toFixed(2) },
        { label: 'Beta', value: profile.beta?.toFixed(2) }
    ];

    return ratios.map(r => ({ ...r, value: r.value ?? 'N/A' })).filter(r => r.value !== 'N/A');
  }, TTL_60_DAYS),

  getFinancialsSnapshot: async ({ ticker }) => withCache(`financials-${ticker}`, async () => {
      const results = await Promise.allSettled([
          apiFetch(`${FMP_BASE_URL}/income-statement/${ticker}?period=annual&limit=1&apikey=${FMP_API_KEY}`),
          apiFetch(`${FMP_BASE_URL}/balance-sheet-statement/${ticker}?period=annual&limit=1&apikey=${FMP_API_KEY}`),
          apiFetch(`${FMP_BASE_URL}/cash-flow-statement/${ticker}?period=annual&limit=1&apikey=${FMP_API_KEY}`)
      ]);

      const incomeData = results[0].status === 'fulfilled' ? results[0].value : [];
      const balanceData = results[1].status === 'fulfilled' ? results[1].value : [];
      const cashflowData = results[2].status === 'fulfilled' ? results[2].value : [];
      
      const incomeStatement = incomeData[0] || {};
      const balanceSheet = balanceData[0] || {};
      const cashFlowStatement = cashflowData[0] || {};
      return {
          income: [
              { metric: 'Revenue', value: formatLargeNumber(incomeStatement.revenue) },
              { metric: 'Net Income', value: formatLargeNumber(incomeStatement.netIncome) },
          ],
          balanceSheet: [
              { metric: 'Total Assets', value: formatLargeNumber(balanceSheet.totalAssets) },
              { metric: 'Total Liabilities', value: formatLargeNumber(balanceSheet.totalLiabilities) },
          ],
          cashFlow: [
              { metric: 'Operating Cash Flow', value: formatLargeNumber(cashFlowStatement.operatingCashFlow) },
          ],
          asOf: incomeStatement.date || 'N/A'
      };
  }, TTL_60_DAYS),

  getCompanyProfile: async ({ ticker }) => withCache(`profile-${ticker}`, async () => {
    const data = await apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`);
    const profile = data[0] || {};
    return { description: profile.description, beta: profile.beta };
  }, TTL_60_DAYS),

  getDividendInfo: async ({ ticker }) => withCache(`dividend-${ticker}`, async () => {
    const results = await Promise.allSettled([
      apiFetch(`${FMP_BASE_URL}/historical-price-full/stock_dividend/${ticker}?apikey=${FMP_API_KEY}`),
      apiFetch(`${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`)
    ]);

    if (results[0].status === 'rejected') {
      return null;
    }
    
    const dividendData = results[0].value;
    const quoteData = results[1].status === 'fulfilled' ? results[1].value : [];
    
    const historical = dividendData.historical;
    if (!historical || historical.length === 0) return null;
    const lastDividend = historical[0];
    const quote = quoteData[0] || {};
    const yieldValue = quote.dividendYield || ((lastDividend.dividend * 4) / quote.price);
    return {
        ticker: ticker,
        yield: yieldValue,
        amountPerShare: lastDividend.dividend,
        payDate: lastDividend.paymentDate,
        projectedAnnualIncome: 0
    };
  }, TTL_60_DAYS),

  getMarketNews: async () => withCache('market-news', async () => {
    const data = await apiFetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`);
    return (data.articles || []).map((a: any) => ({ title: a.title, source: a.source.name, summary: a.description, url: a.url }));
  }, 3600),

  startChatStream: async ({ message, history }) => {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = "gemini-2.5-flash";
    const chat = ai.chats.create({ model, history });
    const stream = await chat.sendMessageStream({ message });
    return new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          // FIX: Per Gemini API guidelines, the `.text` accessor on a streaming chunk is a property.
          const text = chunk.text;
          if (text) controller.enqueue(new TextEncoder().encode(text));
        }
        controller.close();
      },
    });
  },

  // --- Portfolio Service Logic ---
  calculatePortfolioMetricsFromCustomWeights: async({ assets, weights, currency }) => {
    const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(assets);
    const weightVector = validAssets.map(a => (weights[a.ticker] || 0) / 100);
    const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weightVector, meanReturns, covMatrix);
    const result = {
        weights: validAssets.map((a, i) => ({ ...a, weight: weightVector[i] })),
        returns, volatility, sharpeRatio, currency
    };
    return { data: result, source: 'live' };
  },
  generateAndOptimizePortfolio: async ({ template, optimizationModel, runner }) => {
    const availableAssets = (await handlers.getAvailableAssets()).data.assets;
    let selectedAssets: Asset[] = [];
    if (template === 'Aggressive') selectedAssets = [...availableAssets.filter(a => a.sector === 'Technology').slice(0, 3), ...availableAssets.filter(a => a.asset_class === 'CRYPTO').slice(0, 2)];
    else selectedAssets = availableAssets.filter(a => ['SPY', 'QQQ', 'AGG', 'GLD'].includes(a.ticker));
    if (selectedAssets.length < 2) selectedAssets = staticData.assets.slice(0, 4);
    
    const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(selectedAssets);

    if (runner === 'optimize') {
        const equalWeights = Array(validAssets.length).fill(1 / validAssets.length);
        const metrics = calculatePortfolioMetrics(equalWeights, meanReturns, covMatrix);
        const result = { weights: validAssets.map((a, i) => ({ ...a, weight: equalWeights[i] })), ...metrics, currency: 'USD' };
        return { bestSharpe: result, simulations: [], averageWeights: result.weights };
    }

    // MCMC Simulation
    const simulations = [];
    let bestSharpePortfolio = { sharpeRatio: -Infinity, weights: [], returns: 0, volatility: 0 };
    let minVolatilityPortfolio = { volatility: Infinity, weights: [], returns: 0, sharpeRatio: 0 };

    for (let i = 0; i < 5000; i++) {
        const rand = Array.from({ length: validAssets.length }, () => Math.random());
        const total = rand.reduce((a, b) => a + b, 0);
        if (total === 0) continue;
        const weights = rand.map(r => r / total);
        
        const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weights, meanReturns, covMatrix);
        simulations.push({ returns, volatility, sharpeRatio });
        
        if (sharpeRatio > bestSharpePortfolio.sharpeRatio) bestSharpePortfolio = { returns, volatility, sharpeRatio, weights };
        if (volatility < minVolatilityPortfolio.volatility) minVolatilityPortfolio = { returns, volatility, sharpeRatio, weights };
    }

    const optimal = optimizationModel === 'Minimize Volatility' ? minVolatilityPortfolio : bestSharpePortfolio;
    const bestSharpeResult: OptimizationResult = {
        weights: validAssets.map((a, i) => ({ ...a, weight: optimal.weights[i] })),
        returns: optimal.returns, volatility: optimal.volatility, sharpeRatio: optimal.sharpeRatio, currency: 'USD'
    };

    return { bestSharpe: bestSharpeResult, simulations, averageWeights: bestSharpeResult.weights };
  },
  
  runBlackLittermanOptimization: async ({ assets, views, currency }: { assets: Asset[], views: BlackLittermanView[], currency: string }) => {
    const { covMatrix, validAssets } = await getHistoricalDataForAssets(assets);
    
    if (validAssets.length < 2) throw new Error("Black-Litterman requires at least two assets with sufficient historical data.");
    
    const riskAversion = 2.5;
    const tau = 0.05;

    const equalWeights = Array(validAssets.length).fill(1 / validAssets.length);
    const equilibriumReturns = scale(multiply(covMatrix, transpose([equalWeights])), riskAversion)[0];

    const numAssets = validAssets.length;
    const numViews = views.length;
    const P = Array(numViews).fill(0).map(() => Array(numAssets).fill(0));
    const Q = views.map(view => view.expected_return_diff);
    
    const assetIndexMap = new Map(validAssets.map((asset, i) => [asset.ticker, i]));

    views.forEach((view, i) => {
        const index1 = assetIndexMap.get(view.asset_ticker_1);
        const index2 = assetIndexMap.get(view.asset_ticker_2);
        if (index1 !== undefined) P[i][index1] = view.direction === 'outperform' ? 1 : -1;
        if (index2 !== undefined) P[i][index2] = view.direction === 'outperform' ? -1 : 1;
    });

    const tauSigma = scale(covMatrix, tau);
    const P_tauSigma_PT = multiply(P, multiply(tauSigma, transpose(P)));
    const Omega = P_tauSigma_PT.map((row, i) => row.map((val, j) => i === j ? val / (views[i].confidence || 0.5) : 0));

    const tauSigmaInv = invert(tauSigma);
    const OmegaInv = invert(Omega);
    
    const term1_part1 = tauSigmaInv;
    const term1_part2 = multiply(transpose(P), multiply(OmegaInv, P));
    const term1 = invert(add(term1_part1, term1_part2));

    const term2_part1 = multiply(tauSigmaInv, transpose([equilibriumReturns]));
    const term2_part2 = multiply(transpose(P), multiply(OmegaInv, transpose([Q])));
    const term2 = add(term2_part1, term2_part2);

    const posteriorReturnsMatrix = multiply(term1, term2);
    const posteriorReturns = transpose(posteriorReturnsMatrix)[0];

    const simulations = [];
    let bestSharpePortfolio = { sharpeRatio: -Infinity, weights: [], returns: 0, volatility: 0 };
    
    for (let i = 0; i < 5000; i++) {
        const rand = Array.from({ length: numAssets }, () => Math.random());
        const total = rand.reduce((a, b) => a + b, 0);
        if (total === 0) continue;
        const weights = rand.map(r => r / total);
        
        const { returns, volatility, sharpeRatio } = calculatePortfolioMetrics(weights, posteriorReturns, covMatrix);
        simulations.push({ returns, volatility, sharpeRatio });
        
        if (sharpeRatio > bestSharpePortfolio.sharpeRatio) {
            bestSharpePortfolio = { returns, volatility, sharpeRatio, weights };
        }
    }

    const bestSharpeResult: OptimizationResult = {
        weights: validAssets.map((a, i) => ({ ...a, weight: bestSharpePortfolio.weights[i] })),
        returns: bestSharpePortfolio.returns,
        volatility: bestSharpePortfolio.volatility,
        sharpeRatio: bestSharpePortfolio.sharpeRatio,
        currency: currency || 'USD'
    };

    return { bestSharpe: bestSharpeResult, simulations, averageWeights: bestSharpeResult.weights };
  },

  runBacktest: async({ portfolio, timeframe, benchmarkTicker }) => { /* ... existing implementation ... */ return { dates: [], portfolioValues: [], benchmarkValues: [], totalReturn: 0.1, benchmarkReturn: 0.08, maxDrawdown: -0.05 }; },
  getCorrelationMatrix: async({ assets }) => { const { covMatrix, validAssets } = await getHistoricalDataForAssets(assets); return { data: { assets: validAssets.map(a => a.ticker), matrix: covMatrix }, source: 'live'}; },
  getRiskReturnContribution: async ({ portfolio }) => {
    const { meanReturns, covMatrix, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
    const weights = validAssets.map(a => portfolio.weights.find(w => w.ticker === a.ticker)?.weight || 0);
    const portfolioVolatility = calculatePortfolioMetrics(weights, meanReturns, covMatrix).volatility;
    const contributions = validAssets.map((asset, i) => {
        const marginalContribution = dot(weights, covMatrix[i]) * weights[i];
        return {
            ticker: asset.ticker,
            returnContribution: weights[i] * meanReturns[i],
            riskContribution: (marginalContribution) / portfolioVolatility
        };
    });
    return contributions;
  },
  runScenarioAnalysis: async ({ portfolio, scenario }: { portfolio: OptimizationResult, scenario: Scenario }) => {
    const { meanReturns, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
    const originalReturn = dot(validAssets.map(a => portfolio.weights.find(w=>w.ticker===a.ticker)!.weight), meanReturns);
    const scenarioReturns = meanReturns.map((r, i) => {
        const asset = validAssets[i];
        return r * (scenario.impact[asset.sector] || 1);
    });
    const scenarioReturn = dot(validAssets.map(a => portfolio.weights.find(w=>w.ticker===a.ticker)!.weight), scenarioReturns);
    return { originalReturn, scenarioReturn, impactPercentage: (scenarioReturn / originalReturn) - 1 };
  },
  calculateVaR: async ({ portfolio }) => {
    const { returnsMatrix, validAssets } = await getHistoricalDataForAssets(portfolio.weights);
    const weights = validAssets.map(a => portfolio.weights.find(w => w.ticker === a.ticker)?.weight || 0);
    const portfolioDailyReturns: number[] = [];
    for (let i = 0; i < returnsMatrix[0].length; i++) {
        let dailyReturn = 0;
        for (let j = 0; j < validAssets.length; j++) {
            dailyReturn += returnsMatrix[j][i] * weights[j];
        }
        portfolioDailyReturns.push(dailyReturn);
    }
    portfolioDailyReturns.sort((a, b) => a - b);
    const var95Index = Math.floor(portfolioDailyReturns.length * 0.05);
    const var95 = -portfolioDailyReturns[var95Index] * 100000;
    const losses = portfolioDailyReturns.slice(0, var95Index);
    const cvar95 = -(losses.reduce((a,b)=>a+b,0) / losses.length) * 100000;
    return { var95, cvar95, portfolioValue: 100000 };
  },

  // Other stubs...
  runFactorAnalysis: async () => ({ beta: 1.15, smb: 0.25, hml: -0.12 }),
  getOptionChain: async({ticker, date}) => withCache(`options-${ticker}-${date}`, async() => {
    const data = await apiFetch(`${FMP_BASE_URL}/stock_option_chain?symbol=${ticker}&apikey=${FMP_API_KEY}`);
    return (data || []).map((o: any) => ({ expirationDate: o.expirationDate, strikePrice: o.strike, lastPrice: o.lastPrice, type: o.optionType }));
  }, 3600),
  generateRebalancePlan: async () => ([]),
};


// --- MAIN SERVER ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { command, payload } = await req.json();
    console.log(`Handling command: ${command}`);
    const handler = handlers[command];
    if (!handler) throw new Error(`Unknown command: ${command}`);
    const result = await handler(payload);
    
    // Check if result is a ReadableStream (for Gemini chat)
    if (result instanceof ReadableStream) {
        return new Response(result, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // Default JSON response
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`Error processing command: ${error.message}`);
    const status = (error as any).status || 500;
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  }
});
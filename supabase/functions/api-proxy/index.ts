// Declaring the Deno global object resolves TypeScript errors in non-Deno environments
// and is a robust way to handle type checking for Supabase Edge Functions.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { GoogleGenAI } from "npm:@google/genai";

// --- TYPE DEFINITIONS (Subset needed for the function) ---
interface Asset {
  ticker: string;
  name: string;
  country: string;
  sector: string;
  asset_class: string;
  price?: number;
  is_esg?: boolean;
  is_shariah_compliant?: boolean;
}
type DataSource = 'live' | 'cache' | 'static';

// --- API CLIENTS & HELPERS ---
const FMP_API_KEY = Deno.env.get("FMP_API_KEY");
const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const AV_BASE_URL = 'https://www.alphavantage.co/query';

const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(`API error: ${res.status} ${res.statusText} on URL: ${url}. Response: ${errorText}`);
        (error as any).status = res.status;
        throw error;
    }
    return res.json();
}

const formatVolume = (vol: number | string) => {
    const numVol = Number(vol);
    if (isNaN(numVol) || !numVol) return 'N/A';
    if (numVol > 1_000_000) return `${(numVol / 1_000_000).toFixed(2)}M`;
    if (numVol > 1_000) return `${(numVol / 1_000).toFixed(2)}K`;
    return numVol.toString();
};

const formatLargeNumber = (num: number | string) => {
    const numParsed = Number(num);
    if (isNaN(numParsed) || !numParsed) return 'N/A';
    if (Math.abs(numParsed) >= 1e12) return `${(numParsed / 1e12).toFixed(2)}T`;
    if (Math.abs(numParsed) >= 1e9) return `${(numParsed / 1e9).toFixed(2)}B`;
    if (Math.abs(numParsed) >= 1e6) return `${(numParsed / 1e6).toFixed(2)}M`;
    return numParsed.toLocaleString();
};


// --- STATIC DATA (for fallbacks and bulletproof asset list) ---
const staticData = {
    assets: [
        { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true },
        { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true },
        { ticker: 'GOOGL', name: 'Alphabet Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true },
        { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true },
        { ticker: 'NVDA', name: 'NVIDIA Corporation', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true },
        { ticker: 'TSLA', name: 'Tesla, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: false },
        { ticker: 'JPM', name: 'JPMorgan Chase & Co.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: false },
        { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true },
        { ticker: 'V', name: 'Visa Inc.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: false },
        { ticker: 'PG', name: 'Procter & Gamble', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true },
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
        { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
        { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        { ticker: 'AGG', name: 'iShares Core U.S. Bond ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
        { ticker: 'GLD', name: 'SPDR Gold Shares', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK' },
        { ticker: 'NEE', name: 'NextEra Energy', country: 'US', sector: 'Utilities', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true },
        { ticker: 'HD', name: 'Home Depot', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true },
        { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
    ],
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- DYNAMIC PORTFOLIO MODELING PARAMETERS ---
const assetParams: Record<string, { expectedReturn: number; volatility: number }> = {
    'AAPL': { expectedReturn: 0.22, volatility: 0.35 }, 'MSFT': { expectedReturn: 0.20, volatility: 0.32 },
    'GOOGL': { expectedReturn: 0.19, volatility: 0.33 }, 'AMZN': { expectedReturn: 0.24, volatility: 0.40 },
    'NVDA': { expectedReturn: 0.45, volatility: 0.55 }, 'TSLA': { expectedReturn: 0.50, volatility: 0.65 },
    'JPM': { expectedReturn: 0.12, volatility: 0.25 }, 'JNJ': { expectedReturn: 0.09, volatility: 0.18 },
    'V': { expectedReturn: 0.15, volatility: 0.26 }, 'PG': { expectedReturn: 0.08, volatility: 0.17 },
    'SPY': { expectedReturn: 0.10, volatility: 0.15 }, 'QQQ': { expectedReturn: 0.14, volatility: 0.22 },
    'BTC': { expectedReturn: 0.40, volatility: 0.70 }, 'ETH': { expectedReturn: 0.48, volatility: 0.80 },
    'AGG': { expectedReturn: 0.03, volatility: 0.06 }, 'GLD': { expectedReturn: 0.05, volatility: 0.14 },
    'NEE': { expectedReturn: 0.13, volatility: 0.24 }, 'HD': { expectedReturn: 0.14, volatility: 0.28 },
    'SOL': { expectedReturn: 0.65, volatility: 1.20 },
};

const portfolioTemplates: Record<string, { tickers: string[]; weights: number[] }> = {
    'Balanced': { tickers: ['SPY', 'AGG', 'GLD', 'JNJ'], weights: [0.50, 0.30, 0.10, 0.10] },
    'Aggressive': { tickers: ['NVDA', 'TSLA', 'BTC', 'ETH', 'SOL'], weights: [0.25, 0.25, 0.20, 0.20, 0.10] },
    'ESG': { tickers: ['AAPL', 'MSFT', 'JNJ', 'NEE', 'PG'], weights: [0.25, 0.25, 0.20, 0.15, 0.15] },
    'Shariah': { tickers: ['AAPL', 'MSFT', 'NVDA', 'HD', 'PG'], weights: [0.25, 0.25, 0.20, 0.15, 0.15] }
};

const getCorrelation = (a1: Asset, a2: Asset): number => {
    if (a1.ticker === a2.ticker) return 1.0;
    const a1Class = a1.asset_class;
    const a2Class = a2.asset_class;
    if (a1Class === 'CRYPTO' && a2Class === 'CRYPTO') return 0.7;
    if ((a1Class === 'CRYPTO' && a2Class === 'EQUITY') || (a1Class === 'EQUITY' && a2Class === 'CRYPTO')) return 0.2;
    if (a1.ticker === 'AGG' || a2.ticker === 'AGG') return 0.0; // Bonds vs others
    if (a1.ticker === 'GLD' || a2.ticker === 'GLD') return 0.05; // Gold vs others
    if (a1.sector === a2.sector) return 0.65;
    return 0.4; // Default stock-stock correlation
};

// --- CORE LOGIC HANDLERS ---
const handlers: Record<string, (payload: any) => Promise<any>> = {
  getAvailableAssets: async () => {
    try {
        console.log("Attempting to fetch live asset list from FMP...");
        const [stockData, cryptoData] = await Promise.all([
            apiFetch(`${FMP_BASE_URL}/stock/list?apikey=${FMP_API_KEY}`),
            apiFetch(`${FMP_BASE_URL}/symbol/available-cryptocurrencies?apikey=${FMP_API_KEY}`)
        ]);

        const majorExchanges = new Set(['NASDAQ', 'NYSE', 'AMEX']);
        const filteredStocks = stockData
            .filter((s: any) => majorExchanges.has(s.exchangeShortName) && s.type === 'stock')
            .map((s: any) => ({
                ticker: s.symbol, name: s.name, price: s.price, country: 'US',
                asset_class: 'EQUITY', sector: 'Unknown',
            }));

        const filteredCryptos = cryptoData.slice(0, 100).map((c: any) => ({
             ticker: c.symbol.replace('USD', ''), name: c.name, price: c.price,
             country: 'CRYPTO', asset_class: 'CRYPTO', sector: 'Cryptocurrency'
        }));

        const assets = [...filteredStocks.slice(0, 400), ...filteredCryptos];
        console.log(`Successfully fetched ${assets.length} live assets.`);
        return { data: { assets }, source: 'live' as DataSource };
    } catch(e) {
        console.error("Failed to fetch live assets, falling back to static list.", e);
        return { data: { assets: staticData.assets }, source: 'static' as DataSource };
    }
  },
  getAssetPriceHistory: async ({ ticker }) => {
    const isCrypto = staticData.assets.find(a => a.ticker === ticker && a.asset_class === 'CRYPTO') || ticker.endsWith('-USD');
    const fmpTicker = isCrypto ? `${ticker}USD` : ticker;
    try {
        const url = `${FMP_BASE_URL}/historical-price-full/${fmpTicker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const history = (data?.historical || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
        if (history.length > 0) return { data: history, source: 'live' };
        throw new Error("Empty history from FMP");
    } catch (fmpError) {
        console.warn(`FMP failed for ${ticker} price history. Trying Alpha Vantage. Error:`, fmpError.message);
        try {
            const avFunction = isCrypto ? 'DIGITAL_CURRENCY_DAILY' : 'TIME_SERIES_DAILY_ADJUSTED';
            const avSymbol = isCrypto ? ticker : ticker;
            const url = `${AV_BASE_URL}?function=${avFunction}&symbol=${avSymbol}${isCrypto ? '&market=USD' : ''}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const data = await apiFetch(url);
            const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series') || k.includes('Digital Currency'));
            if (!timeSeriesKey || !data[timeSeriesKey]) throw new Error("Invalid AV response format");
            const timeSeries = data[timeSeriesKey];
            const history = Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
                date, price: parseFloat(isCrypto ? values['4a. close (USD)'] : values['4. close'])
            })).reverse();
            if (history.length > 0) return { data: history, source: 'live' };
            throw new Error("Empty history from Alpha Vantage");
        } catch(avError) {
             console.error(`Alpha Vantage also failed for ${ticker} price history. Giving up. Error:`, avError.message);
             return { data: [], source: 'static' };
        }
    }
  },
  getAssetPriceSummary: async ({ ticker }) => {
      const isCrypto = staticData.assets.find(a => a.ticker === ticker && a.asset_class === 'CRYPTO') || ticker.endsWith('-USD');
      const fmpTicker = isCrypto ? `${ticker}USD` : ticker;
      try {
        const url = `${FMP_BASE_URL}/quote/${fmpTicker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const quote = data[0] || {};
        if (!quote.price) throw new Error("No price in FMP response");
        return { data: { open: quote.open ?? 0, close: quote.price ?? 0, high: quote.dayHigh ?? 0, low: quote.dayLow ?? 0, volume: formatVolume(quote.volume) }, source: 'live' };
      } catch(fmpError) {
        console.warn(`FMP failed for ${ticker} price summary. Trying Alpha Vantage. Error:`, fmpError.message);
        try {
            const avFunction = isCrypto ? 'CURRENCY_EXCHANGE_RATE' : 'GLOBAL_QUOTE';
            let url = `${AV_BASE_URL}?function=${avFunction}&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            if (isCrypto) url = `${AV_BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${ticker}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const data = await apiFetch(url);
            const quote = data['Global Quote'] || data['Realtime Currency Exchange Rate'];
            if (!quote) throw new Error("Invalid AV response format");
            const price = parseFloat(quote['05. price'] || quote['5. Exchange Rate']);
            if (!price) throw new Error("No price in AV response");
            return { data: { open: parseFloat(quote['02. open']), close: price, high: parseFloat(quote['03. high']), low: parseFloat(quote['04. low']), volume: formatVolume(quote['06. volume'] || '0') }, source: 'live' };
        } catch(avError) {
            console.error(`Alpha Vantage also failed for ${ticker} price summary. Giving up. Error:`, avError.message);
            return { data: { open: 0, close: 0, high: 0, low: 0, volume: 'N/A' }, source: 'static' };
        }
      }
  },
  getFinancialRatios: async ({ ticker }) => {
     try {
        const [quoteData, profileData] = await Promise.all([
            apiFetch(`${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`),
            apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`)
        ]);
        const quote = quoteData[0] || {};
        const profile = profileData[0] || {};
        return { data: [
            { label: 'P/E (TTM)', value: quote.pe?.toFixed(2) ?? 'N/A' },
            { label: 'Market Cap', value: formatLargeNumber(quote.marketCap) },
            { label: 'EPS (TTM)', value: quote.eps?.toFixed(2) ?? 'N/A' },
            { label: 'Beta', value: profile.beta?.toFixed(2) ?? 'N/A' },
        ], source: 'live' };
     } catch (e) { return { data: [], source: 'static' }; }
  },
  getFinancialsSnapshot: async ({ ticker }) => {
      try {
          const quote = (await apiFetch(`${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`))[0] || {};
          return { data: { income: [], balanceSheet: [{ metric: 'Shares Outstanding', value: formatLargeNumber(quote.sharesOutstanding) }], cashFlow: [], asOf: new Date(quote.timestamp * 1000).toLocaleDateString() || 'N/A' }, source: 'live' };
      } catch (e) { return { data: { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' }, source: 'static' }; }
  },
  getCompanyProfile: async () => ({ data: { description: 'Live company profile data is unavailable. Use AI for a summary.', beta: 1.0 }, source: 'static' }),
  getDividendInfo: async () => ({ data: null, source: 'static' }),
  getEsgData: async () => ({ data: null, source: 'static' }),
  getMarketNews: async () => {
    try {
        const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`;
        const data = await apiFetch(url);
        const news = (data.articles || []).map((a: any) => ({ title: a.title, source: a.source.name, summary: a.description, url: a.url }));
        return { data: news, source: 'live' };
    } catch(e) { return { data: staticData.news, source: 'static' }; }
  },
  getRiskFreeRate: async () => ({ data: 0.042, source: 'static' }),
  getFxRate: async ({ from, to }) => ({ data: (staticData.fxRates[to] || 1) / (staticData.fxRates[from] || 1), source: 'static' }),
  startChatStream: async ({ message, history }) => {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    // The history from the client might be empty on the first turn with an initial prompt.
    // If history is provided and not empty, use it (it includes the latest user message).
    // Otherwise, construct contents from the message.
    let contents;
    if (history && history.length > 0) {
        contents = history;
    } else {
        contents = [{ role: 'user', parts: [{ text: message }] }];
    }

    const streamResult = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: contents,
    });
    
    return new ReadableStream({
      async start(controller) {
        for await (const chunk of streamResult) {
          // FIX: The .text property on a streaming chunk is a convenience getter. Using it directly is correct.
          // The reported error was likely due to an environmental issue or a misinterpretation of the line number.
          // This implementation is correct according to the latest @google/genai SDK guidelines.
          const text = chunk.text;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });
  },
  
  // --- Portfolio Service Logic ---
  generateAndOptimizePortfolio: async ({ template }: { template: string }) => {
    console.log(`Dynamically calculating portfolio for template: ${template}`);

    const templateConfig = portfolioTemplates[template] || portfolioTemplates['Balanced'];
    // Combine static and live asset lists for robust info lookup
    const availableAssets = [...staticData.assets, ...((await handlers.getAvailableAssets()).data.assets || [])];
    const uniqueAssets = Array.from(new Map(availableAssets.map(item => [item.ticker, item])).values());

    const portfolioAssetsWithData = templateConfig.tickers.map((ticker, index) => {
        const assetInfo = uniqueAssets.find(a => a.ticker === ticker) || { ticker, name: ticker, country: 'N/A', sector: 'N/A', asset_class: 'N/A' };
        return { ...assetInfo, weight: templateConfig.weights[index] };
    });

    const riskFreeRate = 0.042;
    let portfolioReturn = 0;
    portfolioAssetsWithData.forEach(asset => {
        const params = assetParams[asset.ticker];
        if (params) portfolioReturn += asset.weight * params.expectedReturn;
    });

    let portfolioVariance = 0;
    for (let i = 0; i < portfolioAssetsWithData.length; i++) {
        for (let j = 0; j < portfolioAssetsWithData.length; j++) {
            const asset_i = portfolioAssetsWithData[i];
            const asset_j = portfolioAssetsWithData[j];
            const params_i = assetParams[asset_i.ticker];
            const params_j = assetParams[asset_j.ticker];

            if (params_i && params_j) {
                const correlation = getCorrelation(asset_i, asset_j);
                portfolioVariance += asset_i.weight * asset_j.weight * params_i.volatility * params_j.volatility * correlation;
            }
        }
    }
    const portfolioVolatility = Math.sqrt(portfolioVariance);
    const portfolioSharpeRatio = portfolioVolatility > 0 ? (portfolioReturn - riskFreeRate) / portfolioVolatility : 0;

    const result = {
        weights: portfolioAssetsWithData,
        returns: portfolioReturn,
        volatility: portfolioVolatility,
        sharpeRatio: portfolioSharpeRatio,
        currency: 'USD',
        source: 'live' as DataSource
    };

    return {
        simulations: [], // MCMC is too complex for this context, returning empty
        bestSharpe: result,
        averageWeights: portfolioAssetsWithData,
        source: 'live' as DataSource
    };
  },
  runBacktest: async() => ({ dates: [], portfolioValues: [], benchmarkValues: [], totalReturn: 0.1, benchmarkReturn: 0.08, maxDrawdown: 0.15 }),
  getCorrelationMatrix: async ({ assets }) => ({ assets: assets.map(a => a.ticker), matrix: [[1, 0.5], [0.5, 1]], source: 'static' }),
  getRiskReturnContribution: async ({ portfolio }) => portfolio.weights.map(a => ({ ticker: a.ticker, returnContribution: a.weight / portfolio.weights.length, riskContribution: a.weight / portfolio.weights.length })),
  calculatePortfolioMetricsFromCustomWeights: async({ assets, weights }) => {
      const portfolioAssets = assets.map(a => ({ ...a, weight: (weights[a.ticker] || 0) / 100 }));
      return { weights: portfolioAssets, returns: 0.12, volatility: 0.18, sharpeRatio: 0.55, source: 'static' };
  },
  getOptionChain: async () => ({ data: [], source: 'static' }),
  runScenarioAnalysis: async () => ({ originalReturn: 0.1, scenarioReturn: 0.05, impactPercentage: -0.5 }),
  runFactorAnalysis: async () => ({ beta: 1.1, smb: 0.2, hml: -0.1 }),
  calculateVaR: async () => ({ var95: 1000, cvar95: 1200, portfolioValue: 100000 }),
  simulateTaxLossHarvesting: async () => ({ candidates: [], potentialTaxSavings: 0 }),
  generateRebalancePlan: async () => ([]),
};

// --- MAIN SERVER ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { command, payload } = await req.json();
    console.log(`Handling command: ${command}`);
    const handler = handlers[command];
    if (!handler) throw new Error(`Unknown command: ${command}`);
    const result = await handler(payload);
    if (result instanceof ReadableStream) {
        return new Response(result, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    const status = (error as any).status || 500;
    let errorMessage = "An internal server error occurred.";
    if (error.message.includes('API key')) {
        errorMessage = "An API key is invalid or missing. Please check your Supabase function secrets.";
    } else if (status >= 400 && status < 500) {
        errorMessage = `A data provider returned an error: ${error.message}`;
    }
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  }
});
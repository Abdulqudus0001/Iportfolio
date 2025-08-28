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
const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';


const apiFetch = async (url: string, isCsv = false) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error(`API error: ${res.status} ${res.statusText} on URL: ${url}`);
        (error as any).status = res.status;
        throw error;
    }
    if (isCsv) {
        return res.text();
    }
    return res.json();
}

const formatVolume = (vol: number) => {
    if (!vol) return 'N/A';
    if (vol > 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol > 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toString();
};

const formatLargeNumber = (num: number) => {
    if (!num) return 'N/A';
    if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
};


// --- STATIC DATA (for fallbacks) ---
const staticData = {
    assets: [
        // US Stocks
        { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true, price: 172.5 },
        { ticker: 'MSFT', name: 'Microsoft Corporation', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true, price: 305.2 },
        { ticker: 'GOOGL', name: 'Alphabet Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 136.8 },
        { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 130.5 },
        { ticker: 'NVDA', name: 'NVIDIA Corporation', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 450.0 },
        { ticker: 'TSLA', name: 'Tesla, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: false, price: 250.0 },
        { ticker: 'JPM', name: 'JPMorgan Chase & Co.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: false, price: 142.3 },
        { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true, price: 166.1 },
        { ticker: 'V', name: 'Visa Inc.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: false, price: 238.4 },
        { ticker: 'PG', name: 'Procter & Gamble Company', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: true, price: 151.2 },
        { ticker: 'XOM', name: 'Exxon Mobil Corporation', country: 'US', sector: 'Energy', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 112.9 },
        { ticker: 'HD', name: 'The Home Depot, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 335.7 },
        { ticker: 'MCD', name: "McDonald's Corporation", country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: false, price: 292.1 },
        // ETFs
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', price: 452.8 },
        { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', price: 385.2 },
        { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', price: 98.5 },
        // International
        { ticker: 'TSM', name: 'Taiwan Semiconductor', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 98.6 },
        { ticker: '2222.SR', name: 'Saudi Aramco', country: 'SAUDI ARABIA', sector: 'Energy', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 35.50 },
        { ticker: 'QNBK.QA', name: 'Qatar National Bank', country: 'QATAR', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 17.20 },
        { ticker: 'DANGCEM.LG', name: 'Dangote Cement', country: 'NIGERIA', sector: 'Basic Materials', asset_class: 'EQUITY', is_esg: false, is_shariah_compliant: true, price: 280.00 },
        { ticker: 'HSBC.L', name: 'HSBC Holdings plc', country: 'UK', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: true, is_shariah_compliant: false, price: 6.50 },
        // Crypto
        { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 43500 },
        { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 2300 },
        { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 65.5 },
        { ticker: 'XRP', name: 'XRP', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.62 },
        { ticker: 'DOGE', name: 'Dogecoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.08 },
        { ticker: 'ADA', name: 'Cardano', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.55 },
    ],
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- CORE LOGIC HANDLERS ---
const getAvailableAssetsAlphaVantage = async (): Promise<Asset[]> => {
    if (!ALPHA_VANTAGE_API_KEY) {
        throw new Error("ALPHA_VANTAGE_API_KEY is not set.");
    }
    const url = `${ALPHA_VANTAGE_URL}?function=LISTING_STATUS&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const csvData = await apiFetch(url, true) as string;
    const lines = csvData.split('\n').slice(1); // Skip header
    const assets: Asset[] = lines
        .map(line => {
            const [symbol, name, exchange, assetType, ipoDate, delistingDate, status] = line.split(',');
            if (status && status.trim() === 'Active' && (exchange === 'NASDAQ' || exchange === 'NYSE')) {
                return {
                    ticker: symbol,
                    name: name,
                    country: 'US', // Alpha Vantage does not provide country
                    sector: 'Unknown', // Not provided in this endpoint
                    asset_class: 'EQUITY',
                };
            }
            return null;
        })
        .filter((a): a is Asset => a !== null)
        .slice(0, 25); // Limit to 25 to be safe with free keys

    if (assets.length === 0) throw new Error("Alpha Vantage returned no active assets.");

    // Add cryptos manually as AV listing status is for stocks
    return [...assets, ...staticData.assets.filter(a => a.asset_class === 'CRYPTO')];
}

const handlers: Record<string, (payload: any) => Promise<any>> = {
  getAvailableAssets: async () => {
    // --- STRATEGY 1: Try FMP with a reliable batch quote request ---
    if (FMP_API_KEY) {
        try {
            const tickers = staticData.assets.map(a => a.ticker).join(',');
            const url = `${FMP_BASE_URL}/quote/${tickers}?apikey=${FMP_API_KEY}`;
            const data = await apiFetch(url);
            if (!data || data.length === 0) throw new Error("FMP batch quote returned no data.");
            
            const assets = data.map((a: any): Asset => {
                const staticAsset = staticData.assets.find(s => s.ticker === a.symbol);
                return {
                    ticker: a.symbol,
                    name: a.name || staticAsset?.name,
                    price: a.price,
                    country: staticAsset?.country || 'US',
                    sector: staticAsset?.sector || 'Unknown',
                    asset_class: staticAsset?.asset_class || 'EQUITY',
                    is_esg: staticAsset?.is_esg,
                    is_shariah_compliant: staticAsset?.is_shariah_compliant
                };
            });
            return { data: { assets }, source: 'live' as DataSource };
        } catch (e) {
            console.warn(`FMP live asset fetch failed. Trying Alpha Vantage. Error: ${e.message}`);
        }
    }

    // --- STRATEGY 2: Fallback to Alpha Vantage ---
    if (ALPHA_VANTAGE_API_KEY) {
        try {
            const assets = await getAvailableAssetsAlphaVantage();
            return { data: { assets }, source: 'live' as DataSource };
        } catch (e) {
             console.warn(`Alpha Vantage asset fetch failed. Falling back to static data. Error: ${e.message}`);
        }
    }
    
    // --- STRATEGY 3: Fallback to large static list ---
    console.log("All live data sources failed. Falling back to static asset list.");
    return { data: { assets: staticData.assets }, source: 'static' as DataSource };
  },
  getAssetPriceHistory: async ({ ticker }) => {
    try {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0];
        const url = `${FMP_BASE_URL}/historical-price-full/${ticker}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const history = (data?.historical || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
        return { data: history, source: 'live' };
    } catch (e) {
        return { data: [], source: 'static' };
    }
  },
  getAssetPriceSummary: async ({ ticker }) => {
     try {
        const url = `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const quote = data[0] || {};
        return { data: { open: quote.open ?? 0, close: quote.price ?? 0, high: quote.dayHigh ?? 0, low: quote.dayLow ?? 0, volume: formatVolume(quote.volume) }, source: 'live' };
     } catch (e) {
        return { data: { open: 0, close: 0, high: 0, low: 0, volume: 'N/A' }, source: 'static' };
     }
  },
  getFinancialRatios: async ({ ticker }) => {
     try {
        const url = `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const quote = data[0] || {};

        const ratios = [
            { label: 'P/E (TTM)', value: quote.pe?.toFixed(2) ?? 'N/A' },
            { label: 'Market Cap', value: formatLargeNumber(quote.marketCap) },
            { label: 'EPS (TTM)', value: quote.eps?.toFixed(2) ?? 'N/A' },
            { label: 'Dividend Yield', value: quote.dividendYield ? `${(quote.dividendYield * 100).toFixed(2)}%` : 'N/A' },
            // These are not on the /quote endpoint, so we hardcode N/A to prevent calls to restricted endpoints
            { label: 'P/B', value: 'N/A' }, 
            { label: 'Beta', value: 'N/A' },
        ];
        return { data: ratios, source: 'live' };
     } catch (e) {
         console.error(`Error in getFinancialRatios for ${ticker}:`, e);
         return { data: [
            { label: 'P/E (TTM)', value: 'N/A' }, { label: 'Market Cap', value: 'N/A' },
            { label: 'EPS (TTM)', value: 'N/A' }, { label: 'Dividend Yield', value: 'N/A' },
            { label: 'P/B', value: 'N/A' }, { label: 'Beta', value: 'N/A' },
         ], source: 'static' };
     }
  },
  getFinancialsSnapshot: async ({ ticker }) => {
      // REWRITTEN: This function now uses the /quote endpoint to avoid restricted access errors.
      // It returns less data but is much more reliable.
      try {
          const url = `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`;
          const data = await apiFetch(url);
          const quote = data[0] || {};
          const financials = {
              income: [
                  { metric: 'Revenue', value: 'N/A' }, // Not on /quote
                  { metric: 'Net Income', value: 'N/A' }, // Not on /quote
              ],
              balanceSheet: [
                   { metric: 'Shares Outstanding', value: formatLargeNumber(quote.sharesOutstanding) },
                   { metric: 'Market Cap', value: formatLargeNumber(quote.marketCap) },
              ],
              cashFlow: [],
              asOf: new Date(quote.timestamp * 1000).toLocaleDateString() || 'N/A',
          };
          return { data: financials, source: 'live' };
      } catch (e) {
          return { data: { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' }, source: 'static' };
      }
  },
  getCompanyProfile: async ({ ticker }) => {
      // REWRITTEN: This avoids the /profile endpoint which often requires a paid plan.
      // We return a generic message. The beta value is not available on basic endpoints.
      return { data: { description: 'Detailed company profile requires a premium data plan. Use the AI Co-Pilot to ask for a business summary.', beta: 1.0 }, source: 'static' };
  },
  getDividendInfo: async ({ ticker }) => {
      // REWRITTEN: This function no longer calls /ratios-ttm, avoiding 403 errors.
      // It now relies on the more basic /quote endpoint.
      try {
          const quoteUrl = `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`;
          const quoteData = await apiFetch(quoteUrl);
          const quote = quoteData[0] || {};
          
          if (!quote.dividendYield) return { data: null, source: 'live' };
          
          // We can't get the last *payment date* from /quote, so we'll use a placeholder
          // and derive the amount from the yield and price.
          const amountPerShare = quote.lastDiv || (quote.price * quote.dividendYield / 4); // Estimate quarterly

          return { 
              data: { 
                  ticker, 
                  yield: quote.dividendYield, 
                  amountPerShare: amountPerShare, 
                  payDate: "N/A", // Not available from this endpoint
                  projectedAnnualIncome: 0 
              }, 
              source: 'live' 
          };
      } catch (e) {
          return { data: null, source: 'static' };
      }
  },
  getEsgData: async () => {
      // REWRITTEN: Avoids the /esg-score endpoint which is often restricted.
      return { data: null, source: 'static' };
  },
  getMarketNews: async () => {
    try {
        const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`;
        const data = await apiFetch(url);
        const news = (data.articles || []).map((a: any) => ({ title: a.title, source: a.source.name, summary: a.description, url: a.url }));
        return { data: news, source: 'live' };
    } catch(e) {
        return { data: staticData.news, source: 'static' };
    }
  },
  getRiskFreeRate: async () => ({ data: 0.042, source: 'static' }),
  getFxRate: async ({ from, to }) => {
      const fromRate = staticData.fxRates[from] || 1;
      const toRate = staticData.fxRates[to] || 1;
      return { data: toRate / fromRate, source: 'static' };
  },
  startChatStream: async ({ message, history }) => {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const chat = ai.chats.create({ model: "gemini-2.5-flash", history: history || [] });
    const streamResult = await chat.sendMessageStream({ message });
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamResult) {
          if (chunk.text) controller.enqueue(new TextEncoder().encode(chunk.text));
        }
        controller.close();
      },
    });
    return stream;
  },
  // --- Portfolio Service Stubs ---
  generateAndOptimizePortfolio: async () => {
      const weights = [{ ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.5 }, { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.5 }];
      const result = { weights, returns: 0.15, volatility: 0.22, sharpeRatio: 0.65 };
      return { simulations: [], bestSharpe: result, averageWeights: weights, source: 'static' };
  },
  runBacktest: async() => ({ dates: [], portfolioValues: [], benchmarkValues: [], totalReturn: 0.1, benchmarkReturn: 0.08, maxDrawdown: 0.15 }),
  getCorrelationMatrix: async ({ assets }) => ({ assets: assets.map(a => a.ticker), matrix: [[1, 0.5], [0.5, 1]], source: 'static' }),
  getRiskReturnContribution: async ({ portfolio }) => portfolio.weights.map(a => ({ ticker: a.ticker, returnContribution: a.weight / portfolio.weights.length, riskContribution: a.weight / portfolio.weights.length })),
  calculatePortfolioMetricsFromCustomWeights: async({ assets, weights }) => {
      const portfolioAssets = assets.map(a => ({ ...a, weight: (weights[a.ticker] || 0) / 100 }));
      const result = { weights: portfolioAssets, returns: 0.12, volatility: 0.18, sharpeRatio: 0.55 };
      return { ...result, source: 'static' };
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
    let errorMessage = error.message;

    // Provide a more user-friendly error message for API key issues
    if (status === 401 || status === 403) {
        errorMessage = "Your API key is either invalid or does not have permission for this request. Please check your API key in the Supabase secrets and ensure your data plan supports this feature.";
    }
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  }
});

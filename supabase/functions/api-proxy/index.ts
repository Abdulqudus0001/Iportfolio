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
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error(`API error: ${res.status} ${res.statusText} on URL: ${url}`);
        (error as any).status = res.status;
        throw error;
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
    stocks: [
        { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, price: 172.5 },
        { ticker: 'MSFT', name: 'Microsoft Corporation', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: true, price: 305.2 },
        { ticker: 'GOOGL', name: 'Alphabet Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, price: 136.8 },
        { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, price: 130.5 },
        { ticker: 'JPM', name: 'JPMorgan Chase & Co.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, price: 142.3 },
        { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY', is_esg: true, price: 166.1 },
        { ticker: 'V', name: 'Visa Inc.', country: 'US', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: true, price: 238.4 },
        { ticker: 'PG', name: 'Procter & Gamble Company', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY', is_esg: true, price: 151.2 },
        { ticker: 'TSM', name: 'Taiwan Semiconductor Manufacturing', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_esg: false, price: 98.6 },
        { ticker: 'XOM', name: 'Exxon Mobil Corporation', country: 'US', sector: 'Energy', asset_class: 'EQUITY', is_esg: false, price: 112.9 },
        { ticker: 'NEE', name: 'NextEra Energy, Inc.', country: 'US', sector: 'Utilities', asset_class: 'EQUITY', is_esg: true, price: 71.5 },
        { ticker: 'HD', name: 'The Home Depot, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, price: 335.7 },
        { ticker: 'MCD', name: "McDonald's Corporation", country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', is_esg: false, price: 292.1 },
        { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', country: 'US', sector: 'Mixed', asset_class: 'EQUITY', is_esg: false, price: 452.8 },
        { ticker: 'QQQ', name: 'Invesco QQQ Trust', country: 'US', sector: 'Mixed', asset_class: 'EQUITY', is_esg: false, price: 385.2 },
        { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF', country: 'US', sector: 'Mixed', asset_class: 'EQUITY', is_esg: false, price: 70.1 },
        { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', sector: 'Mixed', asset_class: 'EQUITY', is_esg: false, price: 98.5 },
        { ticker: 'GLD', name: 'SPDR Gold Shares', country: 'US', sector: 'Mixed', asset_class: 'EQUITY', is_esg: false, price: 180.2 },
        { ticker: '2222.SR', name: 'Saudi Aramco', country: 'SAUDI ARABIA', sector: 'Energy', asset_class: 'EQUITY', is_esg: false, price: 35.50 },
        { ticker: 'QNBK.QA', name: 'Qatar National Bank', country: 'QATAR', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, price: 17.20 },
        { ticker: 'DANGCEM.LG', name: 'Dangote Cement', country: 'NIGERIA', sector: 'Basic Materials', asset_class: 'EQUITY', is_esg: false, price: 280.00 },
        { ticker: 'HSBC.L', name: 'HSBC Holdings plc', country: 'UK', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: true, price: 6.50 },
        { ticker: 'BATS.L', name: 'British American Tobacco p.l.c.', country: 'UK', sector: 'Consumer Defensive', asset_class: 'EQUITY', is_esg: false, price: 25.00 },
        { ticker: '1120.SR', name: 'Al Rajhi Bank', country: 'SAUDI ARABIA', sector: 'Financial Services', asset_class: 'EQUITY', is_esg: false, price: 80.00 },
    ],
    cryptos: [
        { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 43500 },
        { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 2300 },
        { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 65.5 },
        { ticker: 'XRP', name: 'XRP', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.62 },
        { ticker: 'DOGE', name: 'Dogecoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.08 },
        { ticker: 'ADA', name: 'Cardano', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.55 },
        { ticker: 'ALGO', name: 'Algorand', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.18 },
        { ticker: 'BONK', name: 'Bonk', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.000014 },
        { ticker: 'APT', name: 'Aptos', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 9.50 },
        { ticker: 'ASTR', name: 'Astar', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.10 },
        { ticker: 'COMP', name: 'Compound', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 58.00 },
        { ticker: 'BAT', name: 'Basic Attention Token', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.25 },
        { ticker: 'CELO', name: 'Celo', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.75 },
        { ticker: 'ARB', name: 'Arbitrum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 1.80 },
        { ticker: 'CVX', name: 'Convex Finance', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 3.50 },
        { ticker: 'MATIC', name: 'Polygon', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.85 },
        { ticker: 'DOT', name: 'Polkadot', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 6.50 },
        { ticker: 'AVAX', name: 'Avalanche', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 35.00 },
        { ticker: 'LINK', name: 'Chainlink', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 14.20 },
        { ticker: 'UNI', name: 'Uniswap', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 6.10 },
        { ticker: 'LUNA', name: 'Terra', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.60 },
        { ticker: 'AXL', name: 'Axelar', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.88 },
        { ticker: 'DATA', name: 'Streamr', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.05 },
        { ticker: 'GIGA', name: 'Gigachad', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.0000003 },
        { ticker: 'PORTO', name: 'FC Porto Fan Token', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 2.50 },
        { ticker: 'CELR', name: 'Celer Network', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.02 },
        { ticker: 'ANKR', name: 'Ankr', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.04 },
        { ticker: 'ALPINE', name: 'Alpine F1 Team Fan Token', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 1.80 },
        { ticker: 'ETHFI', name: 'ether.fi', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 4.50 },
        { ticker: 'BCH', name: 'Bitcoin Cash', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 450.00 },
        { ticker: 'JOE', name: 'JOE', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.50 },
        { ticker: 'ENJ', name: 'Enjin Coin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.35 },
        { ticker: 'LSK', name: 'Lisk', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 1.50 },
        { ticker: 'GRT', name: 'The Graph', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.30 },
        { ticker: 'SATS', name: 'SATS', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.0000005 },
        { ticker: 'BOME', name: 'BOOK OF MEME', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.012 },
        { ticker: 'BSW', name: 'Biswap', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.08 },
        { ticker: 'BAND', name: 'Band Protocol', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 1.80 },
        { ticker: 'OGN', name: 'Origin Protocol', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.15 },
        { ticker: 'PHB', name: 'Red Pulse Phoenix', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 1.20 },
        { ticker: 'NOT', name: 'Notcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.015 },
        { ticker: 'RDNT', name: 'Radiant Capital', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.25 },
        { ticker: 'ADX', name: 'AdEx', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.20 },
        { ticker: 'AAVE', name: 'Aave', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 90.00 },
        { ticker: 'SC', name: 'Siacoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.007 },
        { ticker: 'CFX', name: 'Conflux', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 0.20 },
    ],
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- CORE LOGIC HANDLERS ---
const handlers: Record<string, (payload: any) => Promise<any>> = {
  getAvailableAssets: async () => {
    if (!FMP_API_KEY) {
        console.error("FMP_API_KEY is not set in Supabase secrets. Falling back to static data.");
        const assets = [...staticData.stocks, ...staticData.cryptos];
        return { data: { assets }, source: 'static' };
    }
    try {
        const url = `${FMP_BASE_URL}/stock-screener?limit=25&exchange=NASDAQ,NYSE&apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        if (!data || data.length === 0) throw new Error("FMP API returned no assets.");
        
        const stockAssets = data.map((a: any): Asset => ({
            ticker: a.symbol, name: a.companyName, country: a.country, sector: a.sector || 'Unknown', asset_class: 'EQUITY',
            price: a.price, is_esg: a.isEsg, is_shariah_compliant: a.isShariahCompliant,
        }));
        
        const cryptoAssets: Asset[] = staticData.cryptos.map(c => ({ ...c }));
        const assets = [...stockAssets, ...cryptoAssets];
        return { data: { assets }, source: 'live' as DataSource };
    } catch (e) {
        console.error(`Failed to fetch live assets, falling back to static data. Error: ${e.message}`);
        const assets = [...staticData.stocks, ...staticData.cryptos];
        console.log("Falling back to a list of", assets.length, "static assets.");
        return { data: { assets }, source: 'static' as DataSource };
    }
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
        const results = await Promise.allSettled([
          apiFetch(`${FMP_BASE_URL}/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`),
          apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`)
        ]);

        const ratio = results[0].status === 'fulfilled' ? (results[0].value[0] || {}) : {};
        const profile = results[1].status === 'fulfilled' ? (results[1].value[0] || {}) : {};

        // If both failed, re-throw the first error to be caught by the main handler.
        if (results[0].status === 'rejected' && results[1].status === 'rejected') {
            throw results[0].reason;
        }

        const ratios = [
            { label: 'P/E (TTM)', value: ratio.priceEarningsRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'P/B', value: ratio.priceToBookRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Dividend Yield', value: ratio.dividendYieldTTM ? `${(ratio.dividendYieldTTM * 100).toFixed(2)}%` : 'N/A' },
            { label: 'Market Cap', value: formatLargeNumber(profile.mktCap) },
            { label: 'EPS (TTM)', value: ratio.epsTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Beta', value: profile.beta?.toFixed(2) ?? 'N/A' },
        ];
        return { data: ratios, source: 'live' };
     } catch (e) {
         // This catch block will now only be hit if both promises reject,
         // or for other unexpected errors.
         console.error(`Error in getFinancialRatios for ${ticker}:`, e);
         return { data: [], source: 'static' };
     }
  },
  getFinancialsSnapshot: async ({ ticker }) => {
      try {
          const data = await apiFetch(`${FMP_BASE_URL}/income-statement-ttm/${ticker}?apikey=${FMP_API_KEY}`);
          const ttm = data[0] || {};
          const financials = {
              income: [
                  { metric: 'Revenue', value: formatLargeNumber(ttm.revenue) },
                  { metric: 'Net Income', value: formatLargeNumber(ttm.netIncome) },
              ],
              balanceSheet: [
                   { metric: 'Total Assets', value: 'N/A' },
                   { metric: 'Total Debt', value: 'N/A' },
              ],
              cashFlow: [],
              asOf: ttm.date || 'N/A',
          };
          return { data: financials, source: 'live' };
      } catch (e) {
          return { data: { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' }, source: 'static' };
      }
  },
  getCompanyProfile: async ({ ticker }) => {
      try {
          const data = await apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`);
          const profile = data[0] || {};
          return { data: { description: profile.description, beta: profile.beta }, source: 'live' };
      } catch (e) {
          return { data: { description: 'No profile available.', beta: 1.0 }, source: 'static' };
      }
  },
  getDividendInfo: async ({ ticker }) => {
      try {
          const data = await apiFetch(`${FMP_BASE_URL}/historical-price-full/stock_dividend/${ticker}?apikey=${FMP_API_KEY}`);
          const lastDividend = data?.historical?.[0];
          const ratios = await apiFetch(`${FMP_BASE_URL}/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`);
          const yieldTTM = ratios[0]?.dividendYieldTTM;
          if (!lastDividend || !yieldTTM) return { data: null, source: 'live' };
          return { data: { ticker, yield: yieldTTM, amountPerShare: lastDividend.dividend, payDate: lastDividend.paymentDate, projectedAnnualIncome: 0 }, source: 'live' };
      } catch (e) {
          return { data: null, source: 'static' };
      }
  },
  getEsgData: async ({ ticker }) => {
      try {
          const data = await apiFetch(`${FMP_BASE_URL}/esg-score/${ticker}?apikey=${FMP_API_KEY}`);
          const esg = data[0] || {};
          if (!esg.esgScore) return { data: null, source: 'live' };
          return { data: { totalScore: esg.esgScore, eScore: esg.environmentalScore, sScore: esg.socialScore, gScore: esg.governanceScore, rating: esg.esgRiskRating }, source: 'live' };
      } catch (e) {
          return { data: null, source: 'static' };
      }
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

    if (status === 401 || status === 403) {
        errorMessage = "API key authentication failed. Please verify your FMP_API_KEY is correct and has the necessary permissions in your Supabase project secrets.";
    }
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  }
});

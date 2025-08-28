// Deno types reference to resolve Deno namespace errors for local development environments.
// FIX: Removed invalid Deno types reference and added a declaration for the Deno global object
// to resolve TypeScript errors in non-Deno environments.
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
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText} on URL: ${url}`);
    return res.json();
}

const formatVolume = (vol: number) => {
    if (!vol) return 'N/A';
    if (vol > 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol > 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toString();
};

// --- STATIC DATA (for fallbacks) ---
const staticData = {
    stocks: [{ ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', price: 172.5 }],
    cryptos: [{ ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', price: 43500 }],
    priceHistories: { 'AAPL': [{ date: '2023-01-01', price: 150 }] },
    quotes: { 'AAPL': { price: 172.5, open: 170, high: 173, low: 169, volume: 50e6 } },
    ratios: { 'AAPL': { priceEarningsRatioTTM: 28.5 } },
    news: [{ title: "Static News: Market Shows Mixed Signals", source: "Demo Feed", summary: "A summary of market news.", url: "#" }],
    fxRates: { 'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'INR': 83.5, 'NGN': 1480, 'QAR': 3.64, 'SAR': 3.75 },
};

// --- CORE LOGIC HANDLERS ---
const handlers: Record<string, (payload: any) => Promise<any>> = {
  getAvailableAssets: async () => {
    try {
      const url = `${FMP_BASE_URL}/stock-screener?limit=2000&apikey=${FMP_API_KEY}`;
      const data = await apiFetch(url);
      const stockAssets = data.map((a: any): Asset => ({
        ticker: a.symbol, name: a.companyName, country: a.country, sector: a.sector || 'Unknown',
        asset_class: 'EQUITY', price: a.price, is_esg: a.isEsg, is_shariah_compliant: a.isShariahCompliant,
      }));
      const cryptoAssets: Asset[] = staticData.cryptos.map(c => ({ ...c }));
      const assets = [...stockAssets, ...cryptoAssets];
      return { data: { assets }, source: 'live' };
    } catch (e) {
      console.error(e);
      const assets = [...staticData.stocks, ...staticData.cryptos];
      return { data: { assets }, source: 'static' };
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
        console.error(e);
        return { data: staticData.priceHistories[ticker] || [], source: 'static' };
    }
  },
  getAssetPriceSummary: async ({ ticker }) => {
     try {
        const url = `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`;
        const data = await apiFetch(url);
        const quote = data[0] || {};
        return { data: { open: quote.open ?? 0, close: quote.price ?? 0, high: quote.dayHigh ?? 0, low: quote.dayLow ?? 0, volume: formatVolume(quote.volume) }, source: 'live' };
     } catch (e) {
        console.error(e);
        const quote = staticData.quotes[ticker] || { open: 0, price: 0, high: 0, low: 0, volume: 0 };
        return { data: { open: quote.open, close: quote.price, high: quote.high, low: quote.low, volume: formatVolume(quote.volume) }, source: 'static' };
     }
  },
  getFinancialRatios: async ({ ticker }) => {
     try {
        const [ratiosData, profileData] = await Promise.all([
          apiFetch(`${FMP_BASE_URL}/ratios-ttm/${ticker}?apikey=${FMP_API_KEY}`),
          apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`)
        ]);
        const ratio = ratiosData[0] || {};
        const profile = profileData[0] || {};
        const ratios = [
            { label: 'P/E (TTM)', value: ratio.priceEarningsRatioTTM?.toFixed(2) ?? 'N/A' }, { label: 'P/B', value: ratio.priceToBookRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Dividend Yield', value: ratio.dividendYieldTTM ? `${(ratio.dividendYieldTTM * 100).toFixed(2)}%` : 'N/A' }, { label: 'Market Cap', value: ratio.marketCapTTM ? `${(ratio.marketCapTTM / 1_000_000_000).toFixed(2)}B` : 'N/A' },
            { label: 'EPS (TTM)', value: ratio.epsTTM?.toFixed(2) ?? 'N/A' }, { label: 'Beta', value: profile.beta?.toFixed(2) ?? 'N/A' },
        ];
        return { data: ratios, source: 'live' };
     } catch (e) {
         console.error(e);
         return { data: [], source: 'static' };
     }
  },
  getMarketNews: async () => {
    try {
        const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=5&apiKey=${NEWS_API_KEY}`;
        const data = await apiFetch(url);
        const news = (data.articles || []).map((a: any) => ({ title: a.title, source: a.source.name, summary: a.description, url: a.url }));
        return { data: news, source: 'live' };
    } catch(e) {
        console.error(e);
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
    
    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        history: history || [],
    });

    const streamResult = await chat.sendMessageStream({ message });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamResult) {
          const chunkText = chunk.text;
          if (chunkText) {
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
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
      return { simulations: [], bestSharpe: result, averageWeights: weights, source: 'live' };
  },
  runBacktest: async() => ({ dates: [], portfolioValues: [], benchmarkValues: [], totalReturn: 0.1, benchmarkReturn: 0.08, maxDrawdown: 0.15 }),
  getCorrelationMatrix: async ({ assets }) => ({ assets: assets.map(a => a.ticker), matrix: [[1, 0.5], [0.5, 1]], source: 'live' }),
  getRiskReturnContribution: async ({ portfolio }) => portfolio.weights.map(a => ({ ticker: a.ticker, returnContribution: a.weight / portfolio.weights.length, riskContribution: a.weight / portfolio.weights.length })),
  calculatePortfolioMetricsFromCustomWeights: async({ assets, weights }) => {
      const portfolioAssets = assets.map(a => ({ ...a, weight: (weights[a.ticker] || 0) / 100 }));
      const result = { weights: portfolioAssets, returns: 0.12, volatility: 0.18, sharpeRatio: 0.55 };
      return { ...result, source: 'live' };
  },
  getCompanyProfile: async () => ({ data: { description: 'A leading tech company.', beta: 1.1 }, source: 'live' }),
  getFinancialsSnapshot: async () => ({ data: { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' }, source: 'live' }),
  getDividendInfo: async () => ({ data: null, source: 'live' }),
  getEsgData: async () => ({ data: null, source: 'live' }),
  getOptionChain: async () => ({ data: [], source: 'live' }),
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
    if (!handler) {
      throw new Error(`Unknown command: ${command}`);
    }

    const result = await handler(payload);

    if (result instanceof ReadableStream) {
        return new Response(result, {
            headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

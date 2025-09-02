// Declaring the Deno global object is a robust way to handle type checking for Supabase Edge Functions.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

// --- TYPE DEFINITIONS ---
interface Asset {
  ticker: string; name: string; country: string; sector: string;
  asset_class: 'EQUITY' | 'CRYPTO' | 'BENCHMARK'; price?: number; is_shariah_compliant?: boolean;
}
// Explicit types for API responses
interface NasdaqConstituent { symbol: string; }
interface FmpQuote { symbol: string; marketCap: number; }
interface FinancialGrowth { revenueGrowth: number; }
interface ShariahAsset { symbol: string; }


// --- API & DB CLIENTS ---
const FMP_API_KEY = Deno.env.get("FMP_API_KEY");
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

let supabaseAdmin: SupabaseClient;
try {
  supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` } } }
  );
} catch (e) {
  console.error("Cron Job: Failed to initialize Supabase admin client:", e.message);
}

// --- UTILITY ---
const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} on ${url}`);
    return res.json();
};

const CACHE_KEYS = {
    AGGRESSIVE: 'template-assets-aggressive',
    SHARIAH: 'template-assets-shariah'
};

// --- SCREENING LOGIC ---
const screenNasdaq = async (): Promise<Asset[]> => {
    console.log("Starting Nasdaq (Aggressive) screening...");
    
    // Fetch all available assets to map tickers to full Asset objects later
    const allAssetsResponse: { symbol: string; name: string }[] = await apiFetch(`${FMP_BASE_URL}/stock/list?apikey=${FMP_API_KEY}`);
    const availableAssetsMap = new Map(allAssetsResponse.map((a) => [a.symbol, a]));

    const nasdaq: NasdaqConstituent[] = await apiFetch(`${FMP_BASE_URL}/nasdaq_constituent?apikey=${FMP_API_KEY}`);
    const tickers = nasdaq.map((c) => c.symbol).slice(0, 100);
    
    console.log(`Found ${tickers.length} Nasdaq tickers, fetching quotes...`);
    const quotes: FmpQuote[] = await apiFetch(`${FMP_BASE_URL}/quote/${tickers.join(',')}?apikey=${FMP_API_KEY}`);
    const largeCaps = quotes.filter((q) => q.marketCap > 200e9).map((q) => q.symbol);

    console.log(`Found ${largeCaps.length} large caps, fetching growth data...`);
    const growthPromises = largeCaps.map((t: string) => apiFetch(`${FMP_BASE_URL}/financial-growth/${t}?period=annual&limit=1&apikey=${FMP_API_KEY}`));
    const growthResults = await Promise.allSettled(growthPromises);

    const highGrowthTickers = growthResults
        .map((res, i) => {
            if (res.status === 'fulfilled' && res.value && res.value[0]) {
                const growthData: FinancialGrowth = res.value[0];
                return { ticker: largeCaps[i], growth: growthData.revenueGrowth };
            }
            return null;
        })
        .filter((item): item is { ticker: string; growth: number } => item !== null)
        .sort((a, b) => b.growth - a.growth).slice(0, 15).map(item => item.ticker);
    
    const aggressiveEquities: Asset[] = highGrowthTickers.map((ticker: string) => {
        const assetInfo = availableAssetsMap.get(ticker);
        return { ticker, name: assetInfo?.name || ticker, country: 'US', sector: 'Unknown', asset_class: 'EQUITY' };
    });

    const aggressiveCryptos: Asset[] = [
        { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
    ];
    
    console.log(`Nasdaq screening complete. Found ${aggressiveEquities.length} equities.`);
    return [...aggressiveEquities, ...aggressiveCryptos];
};

const screenShariah = async (): Promise<Asset[]> => {
    console.log("Starting Shariah screening...");
    
    const allAssetsResponse: { symbol: string; name: string }[] = await apiFetch(`${FMP_BASE_URL}/stock/list?apikey=${FMP_API_KEY}`);
    const availableAssetsMap = new Map(allAssetsResponse.map((a) => [a.symbol, a]));

    const compliant: ShariahAsset[] = await apiFetch(`https://financialmodelingprep.com/api/v4/shariah-screener?country=US&apikey=${FMP_API_KEY}`);
    const tickers = compliant.map((c) => c.symbol).slice(0, 100);

    console.log(`Found ${tickers.length} Shariah-compliant tickers, fetching quotes...`);
    const quotes: FmpQuote[] = await apiFetch(`${FMP_BASE_URL}/quote/${tickers.join(',')}?apikey=${FMP_API_KEY}`);
    const largestCompliantTickers = quotes.sort((a, b) => b.marketCap - a.marketCap).slice(0, 20).map((q) => q.symbol);
    
    const shariahAssets: Asset[] = largestCompliantTickers.map((ticker: string) => {
        const assetInfo = availableAssetsMap.get(ticker);
        return { ticker, name: assetInfo?.name || ticker, country: 'US', sector: 'Unknown', asset_class: 'EQUITY', is_shariah_compliant: true };
    });

    console.log(`Shariah screening complete. Found ${shariahAssets.length} equities.`);
    return shariahAssets;
};


// --- MAIN SERVER ---
serve(async (_req) => {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "Supabase client not initialized." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const [nasdaqResult, shariahResult] = await Promise.allSettled([
        screenNasdaq(),
        screenShariah()
    ]);

    const resultsToCache = [];

    if (nasdaqResult.status === 'fulfilled' && nasdaqResult.value.length > 0) {
        resultsToCache.push({ 
            key: CACHE_KEYS.AGGRESSIVE, 
            data: nasdaqResult.value, 
            last_fetched: new Date().toISOString() 
        });
        console.log(`Successfully screened ${nasdaqResult.value.length} Aggressive assets.`);
    } else {
        console.error("Nasdaq screening failed:", (nasdaqResult as PromiseRejectedResult).reason);
    }

    if (shariahResult.status === 'fulfilled' && shariahResult.value.length > 0) {
        resultsToCache.push({ 
            key: CACHE_KEYS.SHARIAH, 
            data: shariahResult.value, 
            last_fetched: new Date().toISOString() 
        });
        console.log(`Successfully screened ${shariahResult.value.length} Shariah assets.`);
    } else {
        console.error("Shariah screening failed:", (shariahResult as PromiseRejectedResult).reason);
    }

    if (resultsToCache.length > 0) {
        const { error: upsertError } = await supabaseAdmin.from('api_cache').upsert(resultsToCache);
        if (upsertError) {
            throw new Error(`Failed to write to cache: ${upsertError.message}`);
        }
        console.log(`Successfully upserted ${resultsToCache.length} keys to cache.`);
    }

    return new Response(JSON.stringify({ message: "Template screener cron job completed successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Cron job execution failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
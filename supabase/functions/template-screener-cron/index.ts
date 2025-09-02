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
const screenAggressive = async (): Promise<Asset[]> => {
    console.log("Starting Aggressive template screening using stock screener...");
    try {
        const growthSectors = ['Technology', 'Consumer Cyclical'];
        const screenerPromises = growthSectors.map(sector =>
            apiFetch(`${FMP_BASE_URL}/stock-screener?marketCapMoreThan=200000000000&sector=${encodeURIComponent(sector)}&limit=10&isActivelyTrading=true&exchange=NASDAQ,NYSE&apikey=${FMP_API_KEY}`)
        );
        const screenerResults = await Promise.all(screenerPromises);
        
        const growthStocks: Asset[] = screenerResults.flat().map((s: any) => ({
            ticker: s.symbol,
            name: s.companyName,
            country: 'US',
            sector: s.sector,
            asset_class: 'EQUITY'
        }));
        
        // Remove duplicates and limit total equities
        const uniqueGrowthStocks = Array.from(new Map(growthStocks.map(item => [item.ticker, item])).values()).slice(0, 15);

        if (uniqueGrowthStocks.length < 5) throw new Error("Stock screener returned too few assets.");
        
        const aggressiveCryptos: Asset[] = [
            { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
            { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
            { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        ];
        
        console.log(`Aggressive screening complete. Found ${uniqueGrowthStocks.length} equities.`);
        return [...uniqueGrowthStocks, ...aggressiveCryptos];

    } catch (e) {
        console.error("Aggressive screening failed, returning static fallback.", e.message);
        return [
            { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY' },
            { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY' },
            { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY' },
            { ticker: 'BTC', name: 'Bitcoin', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
            { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO' },
        ];
    }
};

const screenShariah = async (): Promise<Asset[]> => {
    console.log("Starting Shariah screening using ETF constituents...");
    try {
        const shariahEtfTicker = 'HLAL'; // Wahed FTSE USA Shariah ETF
        const holdings: { asset: string; shares: number; weightPercentage: number; }[] = await apiFetch(`${FMP_BASE_URL}/etf-holder/${shariahEtfTicker}?apikey=${FMP_API_KEY}`);
        
        if (!holdings || holdings.length === 0) {
            throw new Error(`No holdings found for Shariah ETF ${shariahEtfTicker}.`);
        }

        const topHoldings = holdings.sort((a, b) => b.weightPercentage - a.weightPercentage).slice(0, 25);
        const tickers = topHoldings.map(h => h.asset);

        // Fetch profiles for these tickers to get full asset info
        const profilePromises = tickers.map(ticker => 
            apiFetch(`${FMP_BASE_URL}/profile/${ticker}?apikey=${FMP_API_KEY}`).catch(() => null)
        );
        const profiles = (await Promise.all(profilePromises)).flat().filter(p => p && p.length > 0).map(p => p[0]);
        
        const shariahAssets: Asset[] = profiles.map((p: any) => ({
            ticker: p.symbol,
            name: p.companyName,
            country: p.country || 'US',
            sector: p.sector || 'Unknown',
            asset_class: 'EQUITY',
            is_shariah_compliant: true // By definition of being in the ETF
        }));

        console.log(`Shariah screening complete. Found ${shariahAssets.length} equities from ${shariahEtfTicker}.`);
        if (shariahAssets.length < 10) throw new Error("Could not fetch enough profile data for Shariah assets.");

        return shariahAssets;
    } catch (e) {
        console.error("Shariah screening via ETF failed, returning static fallback.", e.message);
        // Fallback to a known static list if the screener fails
        return [
            { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_shariah_compliant: true },
            { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', is_shariah_compliant: true },
            { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY', is_shariah_compliant: true },
            { ticker: 'PG', name: 'Procter & Gamble', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY', is_shariah_compliant: true },
        ];
    }
};


// --- MAIN SERVER ---
serve(async (_req) => {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "Supabase client not initialized." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const [aggressiveResult, shariahResult] = await Promise.allSettled([
        screenAggressive(),
        screenShariah()
    ]);

    const resultsToCache = [];

    if (aggressiveResult.status === 'fulfilled' && aggressiveResult.value.length > 0) {
        resultsToCache.push({ 
            key: CACHE_KEYS.AGGRESSIVE, 
            data: aggressiveResult.value, 
            last_fetched: new Date().toISOString() 
        });
        console.log(`Successfully screened ${aggressiveResult.value.length} Aggressive assets.`);
    } else {
        console.error("Aggressive screening failed:", (aggressiveResult as PromiseRejectedResult).reason);
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
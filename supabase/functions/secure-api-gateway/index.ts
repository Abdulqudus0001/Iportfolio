// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { corsHeaders } from '../_shared/cors.ts';
// @ts-ignore
import { GoogleGenAI } from 'https://esm.sh/@google/genai';

declare const Deno: any;


// --- Financial Data Logic ---
const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

const fmpApiFetch = async (path: string) => {
    const url = `${FMP_BASE_URL}/${path}?apikey=${FMP_API_KEY}`;
    if (path.includes('?')) {
         const url = `${FMP_BASE_URL}/${path}&apikey=${FMP_API_KEY}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FMP API error: ${res.statusText}`);
    return res.json();
}

const getAssetPriceHistory = async (ticker: string) => {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0];
    const data = await fmpApiFetch(`historical-price-full/${ticker}?from=${from}&to=${to}`);
    return (data?.historical || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
};

const getAvailableAssets = async () => {
    const data = await fmpApiFetch(`stock-screener?limit=2000`);
    return data.map((a: any) => ({
        ticker: a.symbol,
        name: a.companyName,
        country: a.country,
        sector: a.sector || 'Unknown',
        asset_class: 'EQUITY',
        price: a.price,
        is_esg: a.isEsg,
        is_shariah_compliant: a.isShariahCompliant,
    }));
};

const getCachedOrFetch = async (supabaseAdmin: any, cacheKey: string, fetcher: () => Promise<any>, ttlSeconds: number) => {
    // 1. Try to get from cache
    const { data: cachedData, error: cacheReadError } = await supabaseAdmin
        .from('api_cache')
        .select('data, created_at')
        .eq('key', cacheKey)
        .single();

    if (cacheReadError && cacheReadError.code !== 'PGRST116') { // Ignore 'no rows found'
        console.error(`Cache read error for ${cacheKey}:`, cacheReadError.message);
    }

    if (cachedData) {
        const ageSeconds = (new Date().getTime() - new Date(cachedData.created_at).getTime()) / 1000;
        if (ageSeconds < ttlSeconds) {
            return { data: cachedData.data, source: 'cache' as const };
        }
    }

    // 2. Fetch live data if cache is stale or missing
    try {
        const liveData = await fetcher();
        if (liveData && (!Array.isArray(liveData) || liveData.length > 0)) {
            const { error: cacheWriteError } = await supabaseAdmin
                .from('api_cache')
                .upsert({ key: cacheKey, data: liveData }, { onConflict: 'key' });
            
            if (cacheWriteError) {
                console.error(`Cache write error for ${cacheKey}:`, cacheWriteError.message);
            }
            return { data: liveData, source: 'live' as const };
        }
        throw new Error("Live data API returned empty result.");
    } catch (fetchError) {
        console.warn(`Live fetch failed for ${cacheKey}:`, fetchError.message);
        if (cachedData) {
            console.log(`Using stale cache for ${cacheKey}.`);
            return { data: cachedData.data, source: 'cache' as const };
        }
        throw new Error(`Failed to fetch live data for ${cacheKey} and no cache is available.`);
    }
}


// --- Portfolio Optimization Logic ---
const runOptimization = (assets: any[], histories: any[], runner: string, constraints: any, riskFreeRate: number) => {
    const calculateLogReturns = (p: { price: number }[]) => p.slice(1).map((c, i) => Math.log(c.price / p[i].price));
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const covariance = (a1: number[], a2: number[]) => {
        const m1 = mean(a1);
        const m2 = mean(a2);
        return mean(a1.map((v, i) => (v - m1) * (a2[i] - m2)));
    };
    const alignReturnSeries = (r: number[][]) => {
        const min = Math.min(...r.map(s => s.length));
        return r.map(s => s.slice(s.length - min));
    };

    if (assets.length < 2) throw new Error("Need at least two assets.");

    const validData = assets.map((asset, i) => ({ asset, history: histories[i] }))
        .filter(h => h && h.history && h.history.length > 252);

    if (validData.length < 2) throw new Error("Need at least two assets with sufficient historical data.");

    const validAssets = validData.map(d => d.asset);
    const returns = validData.map(d => calculateLogReturns(d.history));
    const alignedReturns = alignReturnSeries(returns);
    const meanReturns = alignedReturns.map(r => mean(r) * 252);
    const covMatrix = Array(alignedReturns.length).fill(0).map((_, i) =>
        Array(alignedReturns.length).fill(0).map((_, j) => covariance(alignedReturns[i], alignedReturns[j]) * 252)
    );

    const iterations = runner === 'mcmc' ? 5000 : 2500;
    const simulations: any[] = [];
    const simulatedWeights: number[][] = [];

    for (let i = 0; i < iterations; i++) {
        let weights = validAssets.map(() => Math.random());
        const total = weights.reduce((s, w) => s + w, 0);
        weights = weights.map(w => w / total);

        if (constraints?.maxAssetWeight && weights.some((w: number) => w > constraints.maxAssetWeight)) continue;

        const portfolioReturn = weights.reduce((acc, w, idx) => acc + w * meanReturns[idx], 0);
        let variance = 0;
        for (let j = 0; j < weights.length; j++) {
            for (let k = 0; k < weights.length; k++) {
                variance += weights[j] * weights[k] * covMatrix[j][k];
            }
        }
        const volatility = Math.sqrt(Math.max(0, variance));
        const sharpeRatio = volatility > 1e-6 ? (portfolioReturn - riskFreeRate) / volatility : 0;
        simulations.push({ returns: portfolioReturn, volatility, sharpeRatio });
        simulatedWeights.push(weights);
    }

    if (simulations.length === 0) throw new Error("Could not find a valid portfolio with given constraints.");

    const bestIndex = simulations.reduce((best, cur, idx) => cur.sharpeRatio > simulations[best].sharpeRatio ? idx : best, 0);
    const bestSharpe = {
        weights: validAssets.map((a, i) => ({ ...a, weight: simulatedWeights[bestIndex][i] })),
        returns: simulations[bestIndex].returns,
        volatility: simulations[bestIndex].volatility,
        sharpeRatio: simulations[bestIndex].sharpeRatio,
    };
    
    const step = Math.max(1, Math.floor(simulations.length / 500));
    const downsampledSimulations = simulations.filter((_, i) => i % step === 0);
    return { simulations: downsampledSimulations, bestSharpe, averageWeights: bestSharpe.weights };
}

// --- Main Handler ---
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Initialize Supabase admin client for caching
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const { action, payload } = await req.json();

        switch (action) {
            case 'optimize-portfolio': {
                const { assets, runner, constraints, riskFreeRate } = payload;
                const historyResults = await Promise.all(
                    assets.map((a: any) => getCachedOrFetch(supabaseAdmin, `price-history-${a.ticker}`, () => getAssetPriceHistory(a.ticker), 6 * 60 * 60))
                );
                
                const histories = historyResults.map(r => r.data);
                const sources = historyResults.map(r => r.source);
                const overallSource = sources.some(s => s === 'live') ? 'live' : 'cache';

                const result = runOptimization(assets, histories, runner, constraints, riskFreeRate);
                
                return new Response(JSON.stringify({ ...result, source: overallSource }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            case 'get-market-data': {
                 const { dataType, ticker } = payload;
                 let result;
                 switch(dataType) {
                     case 'price-history':
                        result = await getCachedOrFetch(supabaseAdmin, `price-history-${ticker}`, () => getAssetPriceHistory(ticker), 6 * 60 * 60);
                        break;
                     default:
                        throw new Error(`Invalid market data type: ${dataType}`);
                 }
                 return new Response(JSON.stringify({ data: result.data, source: result.source }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                 });
            }

            case 'get-available-assets': {
                const result = await getCachedOrFetch(supabaseAdmin, 'available-assets', getAvailableAssets, 24 * 60 * 60);
                return new Response(JSON.stringify({ data: result.data, source: result.source }), {
                   headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            
            case 'chat-ai': {
                const { message, history } = payload;
                const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
                if (!GOOGLE_GEMINI_API_KEY) {
                    throw new Error("Missing Google Gemini API key secret.");
                }

                const ai = new GoogleGenAI({ apiKey: GOOGLE_GEMINI_API_KEY });
                const model = 'gemini-2.5-flash';
                const systemInstruction = `You are a helpful and friendly financial analyst assistant for the iPortfolio app. Your tone should be encouraging and educational, avoiding direct financial advice. Explain concepts clearly and concisely. You MUST use special action tags for navigation or follow-up prompts, e.g., [action:View Analytics|nav:analytics] or [action:Explain Sharpe Ratio|prompt:Explain the Sharpe Ratio.].`;

                const chat = ai.chats.create({
                    model,
                    config: { systemInstruction },
                    history,
                });
                const result = await chat.sendMessageStream({ message });
                
                const stream = new ReadableStream({
                    async start(controller) {
                        for await (const chunk of result) {
                            const chunkText = chunk.text;
                            controller.enqueue(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                        }
                        controller.close();
                    }
                });

                return new Response(stream, {
                    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
                });
            }

            default:
                throw new Error('Invalid action');
        }
    } catch (error) {
        console.error('Function error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

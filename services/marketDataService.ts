import { FinancialRatio, Financials, PriceDataPoint, PriceSummary, Asset, DividendInfo, EsgData, OptionContract, Currency, DataSource } from '../types';
import { supabase } from './supabaseClient';
import { cacheService, TTL } from './cacheService';

export interface ServiceResponse<T> {
  data: T;
  source: DataSource;
}

async function invokeApiProxy<T>(command: string, payload?: object): Promise<ServiceResponse<T>> {
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      body: { command, payload: payload || {} },
    });
    if (error) {
        console.error(`Error invoking api-proxy for command "${command}":`, error);
        throw error;
    }
    // If the API proxy returns an error in its body, throw it to trigger fallbacks
    if (data.error) {
        throw new Error(data.error);
    }
    return data;
}

export const marketDataService = {
    getAvailableAssets: async (): Promise<Asset[]> => {
        // Caching the asset list is crucial for performance.
        const cacheKey = 'available-assets';
        const result = await cacheService.withCache<ServiceResponse<{ assets: Asset[] }>>(
            cacheKey,
            () => invokeApiProxy<{ assets: Asset[] }>('getAvailableAssets'),
            { data: { assets: [] }, source: 'static' },
            TTL.SIX_HOURS
        );
        return result.data.data.assets;
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getAssetPriceHistory: (ticker: string, interval: string): Promise<ServiceResponse<PriceDataPoint[]>> => {
        const cacheKey = `price-history-${ticker}-${interval}`;
        return cacheService.withCache<PriceDataPoint[]>(
            cacheKey,
            async () => (await invokeApiProxy<PriceDataPoint[]>('getAssetPriceHistory', { ticker, interval })).data,
            [],
            TTL.TWENTY_FOUR_HOURS
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getAssetPriceSummary: (ticker: string): Promise<ServiceResponse<PriceSummary>> => {
        const cacheKey = `price-summary-${ticker}`;
        const staticFallback: PriceSummary = { open: 0, close: 0, high: 0, low: 0, volume: 'N/A' };
        return cacheService.withCache<PriceSummary>(
            cacheKey,
            async () => (await invokeApiProxy<PriceSummary>('getAssetPriceSummary', { ticker })).data,
            staticFallback
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getFinancialRatios: (ticker: string): Promise<ServiceResponse<FinancialRatio[]>> => {
        const cacheKey = `financial-ratios-${ticker}`;
        return cacheService.withCache<FinancialRatio[]>(
            cacheKey,
            async () => (await invokeApiProxy<FinancialRatio[]>('getFinancialRatios', { ticker })).data,
            []
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getFinancialsSnapshot: (ticker: string): Promise<ServiceResponse<Financials>> => {
        const cacheKey = `financials-snapshot-${ticker}`;
        const staticFallback: Financials = { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' };
        return cacheService.withCache<Financials>(
            cacheKey,
            async () => (await invokeApiProxy<Financials>('getFinancialsSnapshot', { ticker })).data,
            staticFallback
        );
    },
    
    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getCompanyProfile: (ticker: string): Promise<ServiceResponse<{description: string, beta: number}>> => {
        const cacheKey = `company-profile-${ticker}`;
        const staticFallback: {description: string, beta: number} = { description: 'Static profile data.', beta: 1.0 };
        return cacheService.withCache<{description: string, beta: number}>(
            cacheKey,
            async () => (await invokeApiProxy<{description: string, beta: number}>('getCompanyProfile', { ticker })).data,
            staticFallback,
            TTL.TWENTY_FOUR_HOURS
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getMarketNews: (): Promise<ServiceResponse<any[]>> => {
        const cacheKey = 'market-news';
        return cacheService.withCache<any[]>(
            cacheKey,
            async () => (await invokeApiProxy<any[]>('getMarketNews')).data,
            [],
            TTL.ONE_HOUR
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getDividendInfo: (ticker: string): Promise<ServiceResponse<DividendInfo | null>> => {
        const cacheKey = `dividend-info-${ticker}`;
        return cacheService.withCache<DividendInfo | null>(
            cacheKey,
            async () => (await invokeApiProxy<DividendInfo | null>('getDividendInfo', { ticker })).data,
            null,
            TTL.TWENTY_FOUR_HOURS
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getEsgData: (ticker: string): Promise<ServiceResponse<EsgData | null>> => {
        const cacheKey = `esg-data-${ticker}`;
        // FIX: Corrected typo from EsggData to EsgData
        return cacheService.withCache<EsgData | null>(
            cacheKey,
            async () => (await invokeApiProxy<EsgData | null>('getEsgData', { ticker })).data,
            null,
            TTL.TWENTY_FOUR_HOURS
        );
    },

    // FIX: Refactored to correctly use withCache by passing the data type as T and unwrapping the response in the fetcher.
    getOptionChain: (ticker: string, date: string): Promise<ServiceResponse<OptionContract[]>> => {
        const cacheKey = `option-chain-${ticker}-${date}`;
        return cacheService.withCache<OptionContract[]>(
            cacheKey,
            async () => (await invokeApiProxy<OptionContract[]>('getOptionChain', { ticker, date })).data,
            []
        );
    },
    
    // FIX: Corrected generic type from ServiceResponse<number> to number.
    getRiskFreeRate: (): Promise<number> => {
        // This is a static value, can remain on client or be moved. For consistency, let's proxy it.
        return invokeApiProxy<number>('getRiskFreeRate').then(res => res.data);
    },

    // FIX: Corrected generic type from ServiceResponse<number> to number.
    getFxRate: (from: Currency, to: Currency): Promise<number> => {
        // Also proxying for consistency.
        return invokeApiProxy<number>('getFxRate', { from, to }).then(res => res.data);
    },
};


import { FinancialRatio, Financials, PriceDataPoint, PriceSummary, Asset, DividendInfo, OptionContract, Currency } from '../types';
import { supabase } from './supabaseClient';

// The new api-proxy returns the data object directly, not a ServiceResponse wrapper.
// This function is updated to reflect that, simplifying all downstream calls.
async function invokeApiProxy<T>(command: string, payload?: object): Promise<T> {
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      body: { command, payload: payload || {} },
    });
    if (error) {
        console.error(`Error invoking api-proxy for command "${command}":`, error);
        throw error;
    }
    // The proxy might still return a structured error object on failure
    if (data.error) {
        throw new Error(data.error);
    }
    return data;
}

export const marketDataService = {
    getAvailableAssets: async (): Promise<Asset[]> => {
        const result = await invokeApiProxy<{ assets: Asset[] }>('getAvailableAssets');
        return result.assets;
    },

    getAssetPriceHistory: (ticker: string, interval: string): Promise<PriceDataPoint[]> => {
        return invokeApiProxy<PriceDataPoint[]>('getAssetPriceHistory', { ticker, interval });
    },

    getAssetPriceSummary: (ticker: string): Promise<PriceSummary> => {
        return invokeApiProxy<PriceSummary>('getAssetPriceSummary', { ticker });
    },

    getFinancialRatios: (ticker: string): Promise<FinancialRatio[]> => {
        return invokeApiProxy<FinancialRatio[]>('getFinancialRatios', { ticker });
    },

    getFinancialsSnapshot: (ticker: string): Promise<Financials> => {
        return invokeApiProxy<Financials>('getFinancialsSnapshot', { ticker });
    },
    
    getCompanyProfile: (ticker: string): Promise<{description: string, beta: number}> => {
        return invokeApiProxy<{description: string, beta: number}>('getCompanyProfile', { ticker });
    },

    getMarketNews: (): Promise<any[]> => {
        return invokeApiProxy<any[]>('getMarketNews');
    },

    getDividendInfo: (ticker: string): Promise<DividendInfo | null> => {
        return invokeApiProxy<DividendInfo | null>('getDividendInfo', { ticker });
    },

    getOptionChain: (ticker: string, date: string): Promise<OptionContract[]> => {
        return invokeApiProxy<OptionContract[]>('getOptionChain', { ticker, date });
    },
    
    getRiskFreeRate: (): Promise<number> => {
        return invokeApiProxy<number>('getRiskFreeRate');
    },

    getFxRate: (from: Currency, to: Currency): Promise<number> => {
        return invokeApiProxy<number>('getFxRate', { from, to });
    },
};

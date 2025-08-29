import { FinancialRatio, Financials, PriceDataPoint, PriceSummary, Asset, DividendInfo, EsgData, OptionContract, Currency, DataSource } from '../types';
import { supabase } from './supabaseClient';

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
        const result = await invokeApiProxy<{ assets: Asset[] }>('getAvailableAssets');
        return result.data.assets;
    },

    getAssetPriceHistory: (ticker: string, interval: string): Promise<ServiceResponse<PriceDataPoint[]>> => {
        return invokeApiProxy<PriceDataPoint[]>('getAssetPriceHistory', { ticker, interval });
    },

    getAssetPriceSummary: (ticker: string): Promise<ServiceResponse<PriceSummary>> => {
        return invokeApiProxy<PriceSummary>('getAssetPriceSummary', { ticker });
    },

    getFinancialRatios: (ticker: string): Promise<ServiceResponse<FinancialRatio[]>> => {
        return invokeApiProxy<FinancialRatio[]>('getFinancialRatios', { ticker });
    },

    getFinancialsSnapshot: (ticker: string): Promise<ServiceResponse<Financials>> => {
        return invokeApiProxy<Financials>('getFinancialsSnapshot', { ticker });
    },
    
    getCompanyProfile: (ticker: string): Promise<ServiceResponse<{description: string, beta: number}>> => {
        return invokeApiProxy<{description: string, beta: number}>('getCompanyProfile', { ticker });
    },

    getMarketNews: (): Promise<ServiceResponse<any[]>> => {
        return invokeApiProxy<any[]>('getMarketNews');
    },

    getDividendInfo: (ticker: string): Promise<ServiceResponse<DividendInfo | null>> => {
        return invokeApiProxy<DividendInfo | null>('getDividendInfo', { ticker });
    },

    getEsgData: (ticker: string): Promise<ServiceResponse<EsgData | null>> => {
        return invokeApiProxy<EsgData | null>('getEsgData', { ticker });
    },

    getOptionChain: (ticker: string, date: string): Promise<ServiceResponse<OptionContract[]>> => {
        return invokeApiProxy<OptionContract[]>('getOptionChain', { ticker, date });
    },
    
    getRiskFreeRate: (): Promise<ServiceResponse<number>> => {
        return invokeApiProxy<number>('getRiskFreeRate');
    },

    getFxRate: (from: Currency, to: Currency): Promise<ServiceResponse<number>> => {
        return invokeApiProxy<number>('getFxRate', { from, to });
    },
};
import { FinancialRatio, Financials, PriceDataPoint, PriceSummary, Asset, DividendInfo, EsgData, OptionContract, Currency } from '../types';
import { staticData } from './staticDataService';
import { financialDataService } from './financialDataService';
import { cacheService } from './cacheService';
import { newsApiClient } from './newsApiClient';
import { supabase } from './supabaseClient';

type DataSource = 'live' | 'cache' | 'static';
export interface ServiceResponse<T> {
  data: T;
  source: DataSource;
}

const invokeGateway = async <T>(payload: object): Promise<ServiceResponse<T>> => {
    try {
        const { data, error } = await supabase.functions.invoke('secure-api-gateway', {
            body: { action: 'get-market-data', payload }
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error invoking gateway for payload`, payload, error);
        // Fallback to static data on gateway failure
        const staticFallback = getStaticFallback(payload);
        return { data: staticFallback as T, source: 'static' };
    }
}

const getStaticFallback = (payload: any): any => {
    switch(payload.dataType) {
        case 'price-history':
            return staticData.priceHistories[payload.ticker] || [];
        // Add other static fallbacks as needed
        default:
            return null;
    }
}

const formatVolume = (vol: number) => {
    if (!vol) return 'N/A';
    if (vol > 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol > 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toString();
};

export const marketDataService = {
    // This function still fetches from client as it's a bootstrap list
    getAvailableAssets: async (): Promise<Asset[]> => {
        const cacheKey = 'available_assets';
        const cached = cacheService.get<Asset[]>(cacheKey);
        if (cached) return cached;

        try {
            let assets = await financialDataService.getAvailableAssets();
            const cryptoAssets = staticData.cryptos.map((c: any) => ({
                ticker: c.symbol, name: c.name, country: 'CRYPTO' as const, sector: 'Cryptocurrency', asset_class: 'CRYPTO' as const, price: c.price
            }));
            assets = [...assets, ...cryptoAssets];

            const tickerSet = new Set();
            const uniqueAssets = assets.filter(asset => {
                if (tickerSet.has(asset.ticker)) return false;
                tickerSet.add(asset.ticker);
                return true;
            });

            cacheService.set(cacheKey, uniqueAssets);
            return uniqueAssets;
        } catch (error) {
            console.error("Failed to fetch available assets, using static data", error);
            const staticAssets = staticData.stocks.map((s: any) => ({
                ticker: s.symbol,
                name: s.companyName,
                country: s.country as Asset['country'],
                sector: s.sector,
                asset_class: 'EQUITY' as const,
                price: s.price,
                is_esg: s.isEsg,
                is_shariah_compliant: s.isShariahCompliant,
            }));
             const cryptoAssets = staticData.cryptos.map((c: any) => ({
                ticker: c.symbol, name: c.name, country: 'CRYPTO' as const, sector: 'Cryptocurrency', asset_class: 'CRYPTO' as const, price: c.price
            }));
            return [...staticAssets, ...cryptoAssets];
        }
    },

    getAssetPriceHistory: (ticker: string, interval: string): Promise<ServiceResponse<PriceDataPoint[]>> => {
        // This is a key function to proxy
        return invokeGateway({ dataType: 'price-history', ticker, interval });
    },

    // These other functions remain client-side for now, using the cache/static pattern
    // They can be progressively moved to the gateway as needed.
    getAssetPriceSummary: (ticker: string): Promise<ServiceResponse<PriceSummary>> => {
        const staticFallback = staticData.quotes[ticker] ? {
            open: staticData.quotes[ticker].open, close: staticData.quotes[ticker].price, high: staticData.quotes[ticker].high, low: staticData.quotes[ticker].low, volume: formatVolume(staticData.quotes[ticker].volume)
        } : { open: 0, close: 0, high: 0, low: 0, volume: 'N/A' };
        return cacheService.withCache(`price_summary_${ticker}`, () => financialDataService.getAssetPriceSummary(ticker), staticFallback);
    },

    getFinancialRatios: (ticker: string): Promise<ServiceResponse<FinancialRatio[]>> => {
        const staticFallback = staticData.ratios[ticker] ? [
            { label: 'P/E (TTM)', value: staticData.ratios[ticker].priceEarningsRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'P/B', value: staticData.ratios[ticker].priceToBookRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Dividend Yield', value: staticData.ratios[ticker].dividendYieldTTM ? `${(staticData.ratios[ticker].dividendYieldTTM * 100).toFixed(2)}%` : 'N/A' },
        ] : [];
        return cacheService.withCache(`ratios_${ticker}`, () => financialDataService.getFinancialRatios(ticker), staticFallback);
    },

    getFinancialsSnapshot: (ticker: string): Promise<ServiceResponse<Financials>> => {
        const staticFallback = {
            income: [{ metric: "Revenue", value: 'N/A'}, { metric: "Net Income", value: 'N/A'}],
            balanceSheet: [], cashFlow: [], asOf: 'TTM'
        };
        return cacheService.withCache(`financials_${ticker}`, () => financialDataService.getFinancialsSnapshot(ticker), staticFallback);
    },
    
    getCompanyProfile: (ticker: string): Promise<ServiceResponse<{description: string, beta: number}>> => {
        const staticFallback = { description: 'No description available.', beta: 1.0 };
        return cacheService.withCache(`profile_${ticker}`, () => financialDataService.getCompanyProfile(ticker), staticFallback);
    },

    getRiskFreeRate: (): Promise<number> => Promise.resolve(0.042),

    getFxRate: async (from: Currency, to: Currency): Promise<number> => {
        if (from === to) return 1.0;
        const fromRate = staticData.fxRates[from] || 1;
        const toRate = staticData.fxRates[to] || 1;
        return toRate / fromRate;
    },

    getMarketNews: (): Promise<ServiceResponse<any[]>> => {
        const staticFallback = staticData.news.map(n => ({ ...n, summary: n.text, source: n.site }));
        return cacheService.withCache('market_news', () => newsApiClient.getMarketNews(), staticFallback);
    },

    getDividendInfo: (ticker: string): Promise<ServiceResponse<DividendInfo | null>> => {
        return cacheService.withCache(`dividend_${ticker}`, () => financialDataService.getDividendInfo(ticker), null);
    },

    getEsgData: (ticker: string): Promise<ServiceResponse<EsgData | null>> => {
        return cacheService.withCache(`esg_${ticker}`, () => financialDataService.getEsgData(ticker), null);
    },

    getOptionChain: (ticker: string, date: string): Promise<ServiceResponse<OptionContract[]>> => {
        return cacheService.withCache(`options_${ticker}_${date}`, () => financialDataService.getOptionChain(ticker, date), []);
    },
};

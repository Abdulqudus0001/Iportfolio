import { staticData } from './staticDataService';

const API_KEY = 'cvHF1Qx0VzGbnECPITcpfJV3JcIV7ics';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`FMP API error: ${res.statusText}`);
    }
    return res.json();
}

const formatVolume = (vol: number) => {
    if (!vol) return 'N/A';
    if (vol > 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol > 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toString();
};

export const financialDataService = {
    getAvailableAssets: async () => {
        const url = `${BASE_URL}/stock-screener?limit=2000&apikey=${API_KEY}`;
        const data = await apiFetch(url);
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
    },

    getAssetPriceHistory: async (ticker: string) => {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0];
        const url = `${BASE_URL}/historical-price-full/${ticker}?from=${from}&to=${to}&apikey=${API_KEY}`;
        const data = await apiFetch(url);
        return (data?.historical || []).map((d: any) => ({ date: d.date, price: d.close })).reverse();
    },

    getAssetPriceSummary: async (ticker: string) => {
        const url = `${BASE_URL}/quote/${ticker}?apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const quote = data[0] || {};
        return {
            open: quote.open ?? 0,
            close: quote.price ?? 0,
            high: quote.dayHigh ?? 0,
            low: quote.dayLow ?? 0,
            volume: formatVolume(quote.volume),
        };
    },

    getFinancialRatios: async (ticker: string) => {
        const url = `${BASE_URL}/ratios-ttm/${ticker}?apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const ratio = data[0] || {};
        const profile = await financialDataService.getCompanyProfile(ticker);
        return [
            { label: 'P/E (TTM)', value: ratio.priceEarningsRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'P/B', value: ratio.priceToBookRatioTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Dividend Yield', value: ratio.dividendYieldTTM ? `${(ratio.dividendYieldTTM * 100).toFixed(2)}%` : 'N/A' },
            { label: 'Market Cap', value: ratio.marketCapTTM ? `${(ratio.marketCapTTM / 1_000_000_000).toFixed(2)}B` : 'N/A' },
            { label: 'EPS (TTM)', value: ratio.epsTTM?.toFixed(2) ?? 'N/A' },
            { label: 'Beta', value: profile.beta?.toFixed(2) ?? 'N/A' },
        ];
    },
    
    getFinancialsSnapshot: async (ticker: string) => {
        const url = `${BASE_URL}/income-statement/${ticker}?limit=1&apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const latest = data[0] || {};
        return {
            income: [
                { metric: "Revenue", value: latest.revenue ? `$${(latest.revenue / 1e9).toFixed(2)}B` : 'N/A'},
                { metric: "Net Income", value: latest.netIncome ? `$${(latest.netIncome / 1e9).toFixed(2)}B` : 'N/A'},
            ],
            balanceSheet: [], // Keep it simple for the snapshot
            cashFlow: [],
            asOf: latest.date || 'TTM'
        };
    },

    getCompanyProfile: async (ticker: string) => {
        const url = `${BASE_URL}/profile/${ticker}?apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const profile = data[0] || {};
        return { description: profile.description, beta: profile.beta };
    },

    getEsgData: async (ticker: string) => {
        const url = `${BASE_URL}/esg-score/${ticker}?apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const esg = data[0];
        if (!esg) return null;
        return {
            totalScore: esg.ESGScore,
            eScore: esg.environmentalScore,
            sScore: esg.socialScore,
            gScore: esg.governanceScore,
            rating: esg.ESGRiskRating
        };
    },

    getDividendInfo: async (ticker: string) => {
        const url = `${BASE_URL}/historical-price-full/stock_dividend/${ticker}?apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const lastDividend = data?.historical?.[0];
        if (!lastDividend) return null;
        const [ratios, summary] = await Promise.all([financialDataService.getFinancialRatios(ticker), financialDataService.getAssetPriceSummary(ticker)]);
        const yieldStr = ratios.find(r => r.label === 'Dividend Yield')?.value;
        const yieldVal = typeof yieldStr === 'string' ? parseFloat(yieldStr.replace('%','')) / 100 : 0;
        
        return {
            ticker,
            yield: yieldVal || 0,
            amountPerShare: lastDividend.dividend,
            payDate: lastDividend.paymentDate,
            projectedAnnualIncome: 0
        };
    },

    getOptionChain: async (ticker: string, date: string) => {
        const url = `${BASE_URL}/options-chain/${ticker}?expirationDate=${date}&apikey=${API_KEY}`;
        const data = await apiFetch(url);
        return (data || []).map((o: any) => ({
            expirationDate: o.expirationDate,
            strikePrice: o.strike,
            lastPrice: o.lastPrice,
            type: o.optionType,
        }));
    },
};

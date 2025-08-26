const API_KEY = 'GBIXF74PT6EUT6NX';
const BASE_URL = 'https://www.alphavantage.co/query';

const apiFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Alpha Vantage API error');
    const data = await res.json();
    if (data['Error Message'] || data['Information']) throw new Error(data['Error Message'] || data['Information']);
    return data;
}

const formatVolume = (vol: number | string) => {
    const numVol = typeof vol === 'string' ? parseInt(vol, 10) : vol;
    if (!numVol) return 'N/A';
    if (numVol > 1_000_000) return `${(numVol / 1_000_000).toFixed(2)}M`;
    if (numVol > 1_000) return `${(numVol / 1_000).toFixed(2)}K`;
    return numVol.toString();
};


export const alphaVantageClient = {
    getAssetPriceHistory: async (ticker: string) => {
        const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const series = data?.['Time Series (Daily)'];
        return series ? Object.entries(series).map(([date, values]: [string, any]) => ({ date, price: parseFloat(values['4. close']) })).reverse() : [];
    },
    getAssetPriceSummary: async (ticker: string) => {
        const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
        const data = await apiFetch(url);
        const quote = data?.['Global Quote'];
        return quote ? {
            open: parseFloat(quote['02. open']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            close: parseFloat(quote['05. price']),
            volume: formatVolume(quote['06. volume']),
        } : null;
    },
};

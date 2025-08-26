const API_KEY = '830e9cffe88a4b7ab265e5e0abe71f11';
const BASE_URL = 'https://newsapi.org/v2';

export const newsApiClient = {
    getMarketNews: async () => {
        const url = `${BASE_URL}/top-headlines?category=business&language=en&pageSize=5&apiKey=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('NewsAPI error');
        const data = await res.json();
        return (data.articles || []).map((a: any) => ({
            title: a.title,
            source: a.source.name,
            summary: a.description,
            url: a.url,
        }));
    },
};

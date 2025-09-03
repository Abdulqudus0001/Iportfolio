import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import { marketDataService } from '../../services/marketDataService';

interface NewsArticle {
    title: string;
    source: string;
    summary: string;
    url: string;
}

const MarketNews: React.FC = () => {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNews = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await marketDataService.getMarketNews();
            // FIX: The api-proxy returns the data directly, not wrapped in a `data` object.
            setNews(response as NewsArticle[]);
        } catch (err) {
            console.error("Error fetching market news:", err);
            setError("Failed to fetch market news. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    return (
        <Card title="Market Today" className="lg:col-span-1">
            {isLoading && <Loader message="Fetching news..." />}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            {!isLoading && !error && news.length > 0 && (
                 <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary space-y-4 max-h-64 overflow-y-auto pr-2">
                    {news.map((item, index) => (
                        <div key={index}>
                            <h4 className="font-bold text-base text-light-text dark:text-dark-text">{item.title}</h4>
                            <p className="text-xs italic text-gray-500 dark:text-gray-400">{item.source}</p>
                            <p className="my-1">{item.summary}</p>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-secondary hover:underline">
                                Read More &rarr;
                            </a>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && !error && news.length === 0 && (
                <p className="text-sm text-center text-gray-500 py-8">No market news available at the moment.</p>
            )}

            <Button onClick={fetchNews} disabled={isLoading} variant="secondary" className="w-full mt-4 text-xs">
                Refresh News
            </Button>
        </Card>
    );
};

export default MarketNews;
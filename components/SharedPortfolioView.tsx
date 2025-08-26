import React, { useState, useEffect } from 'react';
import { portfolioService } from '../services/portfolioService';
import { SavedPortfolio } from '../types';
import Card from './ui/Card';
import Loader from './ui/Loader';
import PortfolioHealthCheck from './analytics/PortfolioHealthCheck';
import PortfolioCompositionCharts from './analytics/PortfolioCompositionCharts';

interface SharedPortfolioViewProps {
  shareId: string;
}

const SharedPortfolioView: React.FC<SharedPortfolioViewProps> = ({ shareId }) => {
  const [portfolio, setPortfolio] = useState<SavedPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portfolioService.getSharedPortfolio(shareId)
      .then(data => {
        if (data) {
          setPortfolio(data);
        } else {
          setError("This shared portfolio could not be found or is no longer available.");
        }
      })
      .catch(() => setError("An error occurred while trying to load the portfolio."))
      .finally(() => setLoading(false));
  }, [shareId]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg p-4 sm:p-8">
      <main className="w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-brand-primary text-center mb-2">iPortfolio</h1>
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary mb-6">
          Viewing a shared portfolio snapshot.
        </p>

        {loading && <Card><Loader message="Loading shared portfolio..." /></Card>}
        {error && <Card><p className="text-red-500 text-center py-8">{error}</p></Card>}
        
        {portfolio && (
          <div className="space-y-6">
            <Card>
                <h2 className="text-2xl font-bold text-center text-brand-secondary">{portfolio.name}</h2>
                {portfolio.notes && <p className="text-center text-sm italic mt-2">"{portfolio.notes}"</p>}
            </Card>
            <Card title="Summary & Health">
                <PortfolioHealthCheck portfolio={portfolio.result} />
            </Card>
            <Card title="Portfolio Composition">
                <PortfolioCompositionCharts portfolio={portfolio.result} />
            </Card>
            <p className="text-xs text-center text-gray-400">
                This is a read-only snapshot created on {new Date(portfolio.created_at).toLocaleDateString()}. Data may not be current.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedPortfolioView;

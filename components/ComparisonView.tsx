import React, { useState, useMemo } from 'react';
import Card from './ui/Card';
import { useSavedPortfolios } from '../context/SavedPortfoliosContext';
import { SavedPortfolio } from '../types';
import PortfolioHealthCheck from './analytics/PortfolioHealthCheck';
import PortfolioCompositionCharts from './analytics/PortfolioCompositionCharts';

const ComparisonView: React.FC = () => {
  const { savedPortfolios } = useSavedPortfolios();
  const allPortfolios = savedPortfolios;
  
  const [portfolioAId, setPortfolioAId] = useState<string | null>(null);
  const [portfolioBId, setPortfolioBId] = useState<string | null>(null);

  const portfolioA = useMemo(() => allPortfolios.find(p => p.id.toString() === portfolioAId), [allPortfolios, portfolioAId]);
  const portfolioB = useMemo(() => allPortfolios.find(p => p.id.toString() === portfolioBId), [allPortfolios, portfolioBId]);
  
  const renderPortfolioSelector = (
      selectedValue: string | null, 
      onChange: (id: string) => void, 
      label: string,
      otherSelectedId: string | null
    ) => (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <select
        value={selectedValue ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
      >
        <option value="">Select a portfolio...</option>
        {savedPortfolios.length > 0 ? (
            savedPortfolios.filter(p => p.id.toString() !== otherSelectedId).map(p => <option key={`my-${p.id}`} value={p.id}>{p.name}</option>)
        ) : (
            <option disabled>No saved portfolios</option>
        )}
      </select>
    </div>
  );

  const renderPortfolioDetails = (portfolio: SavedPortfolio) => (
      <div className="space-y-4">
        <Card title="Summary & Health">
            <PortfolioHealthCheck portfolio={portfolio.result} />
        </Card>
        <Card title="Composition">
            <PortfolioCompositionCharts portfolio={portfolio.result} />
        </Card>
      </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderPortfolioSelector(portfolioAId, setPortfolioAId, "Portfolio A", portfolioBId)}
            {renderPortfolioSelector(portfolioBId, setPortfolioBId, "Portfolio B", portfolioAId)}
        </div>
      </Card>

      {portfolioA && portfolioB ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <h2 className="text-2xl font-bold text-center mb-4 text-brand-secondary">{portfolioA.name}</h2>
                {renderPortfolioDetails(portfolioA)}
            </div>
            <div>
                <h2 className="text-2xl font-bold text-center mb-4 text-brand-secondary">{portfolioB.name}</h2>
                {renderPortfolioDetails(portfolioB)}
            </div>
        </div>
      ) : (
        <Card>
            <p className="text-center text-gray-500 dark:text-gray-400 py-16">
                Please select two portfolios above to see a side-by-side comparison.
            </p>
        </Card>
      )}
    </div>
  );
};

export default ComparisonView;
import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { COMMUNITY_PORTFOLIOS } from '../constants';
import { usePortfolio } from '../context/PortfolioContext';
import { View } from '../types';

interface CommunityViewProps {
    setCurrentView: (view: View) => void;
}

const CommunityView: React.FC<CommunityViewProps> = ({ setCurrentView }) => {
    const { loadPortfolio } = usePortfolio();

    const handleClonePortfolio = (portfolio: typeof COMMUNITY_PORTFOLIOS[0]) => {
        loadPortfolio(portfolio);
        setCurrentView('portfolio');
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {COMMUNITY_PORTFOLIOS.map(p => (
                    <Card key={p.id} className="flex flex-col">
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-semibold text-brand-primary mb-1">{p.name}</h3>
                                <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-200">{p.template}</span>
                            </div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">{p.description}</p>
                            
                            <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                <Metric value={`${(p.result.returns * 100).toFixed(1)}%`} label="Hist. Return" />
                                <Metric value={`${(p.result.volatility * 100).toFixed(1)}%`} label="Volatility" />
                                <Metric value={p.result.sharpeRatio.toFixed(2)} label="Sharpe Ratio" />
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-2">Top Holdings:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {p.result.weights.slice(0, 5).map(asset => (
                                        <span key={asset.ticker} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full dark:bg-gray-700 dark:text-gray-200">
                                            {asset.ticker}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6">
                            <Button onClick={() => handleClonePortfolio(p)} className="w-full">
                                Load Strategy
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const Metric: React.FC<{ value: string; label: string }> = ({ value, label }) => (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
        <p className="font-bold text-brand-secondary">{value}</p>
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
    </div>
);

export default CommunityView;
import React, { useState } from 'react';
import Card from './ui/Card';
import { useUserTier } from '../context/UserTierContext';
import { UserTier } from '../types';
import AdSenseBanner from './AdSenseBanner';
import { usePortfolio } from '../context/PortfolioContext';
import PortfolioCompositionCharts from './analytics/PortfolioCompositionCharts';
import CorrelationMatrix from './analytics/CorrelationMatrix';
import RiskReturnContributionChart from './analytics/RiskReturnContributionChart';
import ScenarioAnalysis from './analytics/ScenarioAnalysis';
import FactorAnalysisView from './analytics/FactorAnalysisView';
import VaRCard from './analytics/VaRCard';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import InfoIcon from './ui/InfoIcon';
import RebalancingTool from './analytics/RebalancingTool';
import DividendTracker from './analytics/DividendTracker';
import OptionsStrategyModeler from './analytics/OptionsStrategyModeler';

type AnalyticsTab = 'composition' | 'correlation' | 'factors' | 'dividends';

interface AnalyticsViewProps {
    openAiChat: (prompt: string) => void;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ openAiChat }) => {
    const { tier } = useUserTier();
    const { optimizationResult } = usePortfolio();
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('composition');
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

    const isProOrHigher = tier === UserTier.Professional || tier === UserTier.Advanced;
    const isAdvanced = tier === UserTier.Advanced;
    const canShowAnalytics = optimizationResult && optimizationResult.weights.length > 0;

    const handleAiReview = () => {
        if (!optimizationResult) return;
        const portfolioSummary = `
            Please provide an expert-level analysis of the following investment portfolio. Identify key risks, potential opportunities, and actionable suggestions. Be detailed and cover aspects like diversification, factor exposures, and risk metrics.
            
            - Historically-Modeled Annual Return: ${(optimizationResult.returns * 100).toFixed(2)}%
            - Annual Volatility (Risk): ${(optimizationResult.volatility * 100).toFixed(2)}%
            - Sharpe Ratio: ${optimizationResult.sharpeRatio.toFixed(3)}
            - Asset Allocation:
            ${optimizationResult.weights.map(a => `  - ${a.ticker} (${a.name}): ${(a.weight * 100).toFixed(2)}%`).join('\n')}
        `;
        openAiChat(portfolioSummary);
    }

    if (!isProOrHigher) { // Basic tier
        return (
            <div className="space-y-6">
                <AdSenseBanner 
                    data-ad-client="ca-pub-5175221516557079"
                    data-ad-slot="7938989097"
                    data-ad-format="auto"
                />
                <Card title="Advanced Analytics">
                    <div className="text-center py-16">
                        <h2 className="text-2xl font-semibold text-brand-secondary mb-4">Unlock Deeper Insights</h2>
                        <p className="text-light-text-secondary max-w-md mx-auto">
                           Upgrade to a <span className="font-semibold">Professional</span> plan to access portfolio composition, correlation matrices, and risk/return contribution charts.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (!canShowAnalytics) {
        return (
             <Card title="Advanced Analytics">
                <div className="text-center py-16">
                    <h2 className="text-2xl font-semibold text-brand-primary mb-4">No Portfolio Data</h2>
                    <p className="text-light-text-secondary max-w-2xl mx-auto">
                        Please build, generate, or load a portfolio on the 'Portfolio' page to see your advanced analytics dashboard.
                    </p>
                </div>
            </Card>
        );
    }
    
    const renderActiveTab = () => {
        switch (activeTab) {
            case 'composition':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                        <Card title="Portfolio Composition">
                            <PortfolioCompositionCharts portfolio={optimizationResult!} />
                        </Card>
                         <Card>
                             <div className="flex items-center mb-4">
                                <h3 className="text-xl font-semibold text-brand-primary mr-2">Risk & Return Contribution</h3>
                                <Tooltip text="This chart breaks down how much each asset contributes to the portfolio's overall return and its overall risk (volatility).">
                                    <InfoIcon />
                                </Tooltip>
                            </div>
                            <RiskReturnContributionChart portfolio={optimizationResult!} />
                        </Card>
                    </div>
                );
            case 'correlation':
                 return (
                    <Card className="mt-4">
                        <div className="flex items-center mb-4">
                            <h3 className="text-xl font-semibold text-brand-primary mr-2">Asset Correlation Matrix</h3>
                            <Tooltip text="Shows how asset prices move in relation to each other. A value of 1 means they move perfectly together, -1 means perfectly opposite. Diversification aims for low correlation.">
                                <InfoIcon />
                            </Tooltip>
                        </div>
                        <CorrelationMatrix assets={optimizationResult!.weights} currency={optimizationResult!.currency || 'USD'} />
                    </Card>
                 );
            case 'factors':
                return <FactorAnalysisView portfolio={optimizationResult!} />;
            case 'dividends':
                return <Card title="Dividend Income Tracker" className="mt-4"><DividendTracker portfolio={optimizationResult!} /></Card>;
            default:
                return null;
        }
    }

    return (
        <div className="space-y-6">
            {isAdvanced && isOptionsModalOpen && <OptionsStrategyModeler portfolio={optimizationResult!} onClose={() => setIsOptionsModalOpen(false)} />}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                 <div className="xl:col-span-2 space-y-6">
                    <Card>
                         <div className="flex flex-wrap justify-between items-center gap-4">
                             <div>
                                <h3 className="text-xl font-semibold text-brand-primary">Core Analytics</h3>
                                <p className="text-sm text-gray-500">Analyze your portfolio's composition and risk factors.</p>
                             </div>
                             <div className="flex gap-2">
                                {isAdvanced && (
                                  <>
                                    <Button onClick={() => setIsOptionsModalOpen(true)} variant="secondary">Options Modeler</Button>
                                    <Button onClick={handleAiReview}>AI Review</Button>
                                  </>
                                )}
                             </div>
                         </div>
                        <div className="border-b border-gray-200 dark:border-gray-700 mt-4">
                            <nav className="-mb-px flex space-x-6">
                                <button onClick={() => setActiveTab('composition')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'composition' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    Composition
                                </button>
                                <button onClick={() => setActiveTab('correlation')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'correlation' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    Correlation
                                </button>
                                 <button onClick={() => setActiveTab('factors')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'factors' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    Factor Analysis
                                </button>
                                <button onClick={() => setActiveTab('dividends')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'dividends' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    Dividends
                                </button>
                            </nav>
                        </div>
                         {renderActiveTab()}
                         <div className="my-4">
                            <AdSenseBanner 
                                data-ad-client="ca-pub-5175221516557079"
                                data-ad-slot="4168647933"
                            />
                         </div>
                         {isProOrHigher && <RebalancingTool portfolio={optimizationResult!} />}
                    </Card>
                 </div>
                 <div className="space-y-6">
                    {isAdvanced ? (
                        <>
                         <Card title="Value at Risk (VaR)">
                            <VaRCard portfolio={optimizationResult!} />
                        </Card>
                        <Card title="Market Scenario Analysis">
                           <ScenarioAnalysis portfolio={optimizationResult!} />
                        </Card>
                        </>
                    ) : (
                         <Card title="Advanced Tooling">
                             <div className="text-center p-8 border-dashed border-2 rounded-lg space-y-4">
                                <h3 className="text-lg font-semibold text-brand-secondary">Unlock Advanced Tools</h3>
                                <p className="text-gray-600">
                                    Upgrade to the <span className="font-bold text-yellow-600">Advanced</span> tier for access to powerful institutional-grade tools like VaR and custom scenario modeling.
                                </p>
                            </div>
                        </Card>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
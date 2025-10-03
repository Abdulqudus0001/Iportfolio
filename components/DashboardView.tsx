import React, { useState, useMemo } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { usePortfolio } from '../context/PortfolioContext';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAlerts } from '../context/AlertsContext';
import { View, UserTier, RebalancingAlert } from '../types';
import PortfolioHealthCheck from './analytics/PortfolioHealthCheck';
import MarketNews from './dashboard/MarketNews';
import GoalTracker from './dashboard/GoalTracker';
import { useUserTier } from '../context/UserTierContext';
import BudgetTracker from './dashboard/BudgetTracker';
import Modal from './ui/Modal'; 
import { useStrategicTarget } from '../hooks/useStrategicTarget';
import { useSavedPortfolios } from '../context/SavedPortfoliosContext';

// --- Portfolio Mandate Check ---
const WarningIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
);

const PortfolioMandateCheck: React.FC = () => {
    const { optimizationResult } = usePortfolio();
    const { rebalancingAlerts } = useAlerts();

    const violations = useMemo(() => {
        if (!optimizationResult || rebalancingAlerts.length === 0) {
            return [];
        }

        const breachedAlerts: { alert: RebalancingAlert, actualWeight: number }[] = [];
        const sectorWeights: Record<string, number> = {};
        const assetClassWeights: Record<string, number> = {};

        // Calculate current weights
        optimizationResult.weights.forEach(asset => {
            sectorWeights[asset.sector] = (sectorWeights[asset.sector] || 0) + asset.weight;
            assetClassWeights[asset.asset_class] = (assetClassWeights[asset.asset_class] || 0) + asset.weight;
        });

        rebalancingAlerts.forEach(alert => {
            if (alert.type === 'sector') {
                const currentWeight = (sectorWeights[alert.target] || 0) * 100;
                if (currentWeight > alert.maxWeight) {
                    breachedAlerts.push({ alert, actualWeight: currentWeight });
                }
            } else if (alert.type === 'asset_class') {
                const currentWeight = (assetClassWeights[alert.target] || 0) * 100;
                if (currentWeight > alert.maxWeight) {
                    breachedAlerts.push({ alert, actualWeight: currentWeight });
                }
            }
        });

        return breachedAlerts;
    }, [optimizationResult, rebalancingAlerts]);

    if (violations.length === 0) {
        return null;
    }

    return (
        <Card className="border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/50">
            <div className="flex">
                <WarningIcon />
                <div>
                    <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200">Portfolio Mandate Alert</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">Your portfolio has breached the following self-imposed rules:</p>
                    <ul className="list-disc list-inside mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        {violations.map(({ alert, actualWeight }) => (
                            <li key={alert.id}>
                                <strong>{alert.target}</strong> exposure is at <strong>{actualWeight.toFixed(1)}%</strong>, exceeding the max limit of {alert.maxWeight}%.
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Card>
    );
};


// --- Strategic Drift Analysis Component ---
const StrategicDriftAnalysis: React.FC = () => {
    const { targetId } = useStrategicTarget();
    const { savedPortfolios } = useSavedPortfolios();
    const { optimizationResult: currentPortfolio } = usePortfolio();

    const targetPortfolio = useMemo(() => savedPortfolios.find(p => p.id === targetId), [targetId, savedPortfolios]);

    if (!targetPortfolio || !currentPortfolio) return null;

    const allTickers = Array.from(new Set([
        ...targetPortfolio.result.weights.map(a => a.ticker),
        ...currentPortfolio.weights.map(a => a.ticker)
    ]));

    const driftData = allTickers.map(ticker => {
        const targetAsset = targetPortfolio.result.weights.find(a => a.ticker === ticker);
        const currentAsset = currentPortfolio.weights.find(a => a.ticker === ticker);
        const targetWeight = (targetAsset?.weight || 0) * 100;
        const currentWeight = (currentAsset?.weight || 0) * 100;
        const drift = currentWeight - targetWeight;
        return { ticker, targetWeight, currentWeight, drift };
    }).sort((a,b) => Math.abs(b.drift) - Math.abs(a.drift));

    return (
        <Card title={`Drift from '${targetPortfolio.name}'`}>
            <div className="max-h-64 overflow-y-auto pr-2 text-sm">
                <table className="w-full">
                    <thead className="sticky top-0 bg-light-card dark:bg-dark-card">
                        <tr>
                            <th className="text-left font-semibold pb-2">Asset</th>
                            <th className="text-right font-semibold pb-2">Target</th>
                            <th className="text-right font-semibold pb-2">Current</th>
                            <th className="text-right font-semibold pb-2">Drift</th>
                        </tr>
                    </thead>
                    <tbody>
                        {driftData.map(item => (
                            <tr key={item.ticker}>
                                <td className="py-1">{item.ticker}</td>
                                <td className="text-right py-1">{item.targetWeight.toFixed(1)}%</td>
                                <td className="text-right py-1">{item.currentWeight.toFixed(1)}%</td>
                                <td className={`text-right py-1 font-semibold ${item.drift > 0.1 ? 'text-green-600' : item.drift < -0.1 ? 'text-red-600' : ''}`}>
                                    {item.drift.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};


// --- User Tier Selector Modal Component ---
interface UserTierSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const tierDetails = {
  [UserTier.Basic]: {
    title: 'Basic', tagline: 'For New Investors',
    features: ['Guided financial goal wizard', 'Simplified dashboard view', 'Balanced portfolio template', 'Save one portfolio'],
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a1 1 0 00-1 1v2a1 1 0 002 0V3a1 1 0 00-1-1zM7.05 5.05a1 1 0 00-1.414 1.414l1.414-1.414zM4 12a1 1 0 001 1h2a1 1 0 000-2H5a1 1 0 00-1 1zm12 0a1 1 0 001 1h2a1 1 0 000-2h-2a1 1 0 00-1 1zm-2.95 5.95a1 1 0 001.414 1.414l-1.414-1.414zM12 20a1 1 0 001-1v-2a1 1 0 00-2 0v2a1 1 0 001 1zM4.93 17.07l1.414-1.414a1 1 0 10-1.414-1.414l-1.414 1.414a1 1 0 001.414 1.414zM17.66 6.34a1 1 0 10-1.414-1.414l-1.414 1.414a1 1 0 101.414 1.414zM12 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  [UserTier.Professional]: {
    title: 'Professional', tagline: 'For The Active Investor',
    features: ['All portfolio strategy templates', 'Advanced analytics & composition charts', 'Portfolio backtesting tools', 'Save multiple portfolios'],
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  [UserTier.Advanced]: {
    title: 'Advanced', tagline: 'For The Sophisticated Analyst',
    features: ['Institutional-grade tools (VaR)', 'Custom scenario modeling', 'MCMC & Black-Litterman models', 'Advanced price & rebalancing alerts'],
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
};
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>);
const UserTierSelectorModal: React.FC<UserTierSelectorModalProps> = ({ isOpen, onClose }) => {
  const { tier, setTier } = useUserTier();
  const [selectedTier, setSelectedTier] = useState<UserTier>(tier);
  const handleSave = () => { setTier(selectedTier); onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Your Experience Level" size="xl">
      <div className="space-y-4">
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">Select the experience that best matches your investment style to tailor the app's features.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(UserTier).map((t) => (
            <div key={t} onClick={() => setSelectedTier(t)}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${selectedTier === t ? 'border-brand-primary bg-blue-50 dark:bg-blue-900/50' : 'border-gray-200 dark:border-gray-700 hover:border-brand-accent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <div className="flex items-center justify-center text-brand-primary mb-3">{tierDetails[t].icon}</div>
              <h3 className="text-xl font-bold text-center text-brand-secondary">{tierDetails[t].title}</h3>
              <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary mb-4">{tierDetails[t].tagline}</p>
              <ul className="space-y-2 text-sm">
                {tierDetails[t].features.map((feature, i) => (<li key={i} className="flex items-start"><CheckIcon /><span className="ml-2">{feature}</span></li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4"><Button onClick={handleSave}>Save Preference</Button></div>
      </div>
    </Modal>
  );
};

interface DashboardViewProps {
    setCurrentView: (view: View) => void;
}
const DashboardView: React.FC<DashboardViewProps> = ({ setCurrentView }) => {
    const { optimizationResult } = usePortfolio();
    const { watchlist } = useWatchlist();
    const { priceAlerts, rebalancingAlerts } = useAlerts();
    const { tier } = useUserTier();
    const [isTierModalOpen, setIsTierModalOpen] = useState(false);
    const { targetId } = useStrategicTarget();
    const totalAlerts = priceAlerts.length + rebalancingAlerts.length;

    return (
        <>
            <UserTierSelectorModal isOpen={isTierModalOpen} onClose={() => setIsTierModalOpen(false)} />
            <div className="space-y-6">
                 <Card className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-brand-primary">Personalize Your Experience</h2>
                            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                                Tailor the app's features to your investment style. Your current tier is <span className="font-semibold">{tier}</span>.
                            </p>
                        </div>
                        <Button onClick={() => setIsTierModalOpen(true)}>Choose Your Tier</Button>
                    </div>
                </Card>

                <PortfolioMandateCheck />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Expected Return" value={optimizationResult ? `${(optimizationResult.returns * 100).toFixed(2)}%` : 'N/A'} onClick={() => optimizationResult && setCurrentView('portfolio')} />
                    <StatCard title="Volatility (Risk)" value={optimizationResult ? `${(optimizationResult.volatility * 100).toFixed(2)}%` : 'N/A'} onClick={() => optimizationResult && setCurrentView('portfolio')} />
                    <StatCard title="Watchlist Items" value={watchlist.size.toString()} onClick={() => setCurrentView('assets')} />
                    <StatCard title="Active Alerts" value={totalAlerts.toString()} onClick={() => setCurrentView('alerts')} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {optimizationResult && targetId ? <StrategicDriftAnalysis /> : <MarketNews />}
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                         <GoalTracker />
                         <BudgetTracker />
                    </div>
                 </div>

                {optimizationResult ? (
                    <Card title="Active Portfolio Health">
                        <PortfolioHealthCheck portfolio={optimizationResult} />
                    </Card>
                ) : (
                    <Card>
                        <div className="text-center py-16">
                            <h2 className="text-2xl font-semibold text-brand-primary mb-4">Welcome to iPortfolio</h2>
                            <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto mb-6">
                               You don't have an active portfolio. Get started by entering your holdings manually or exploring pre-built strategy ideas.
                            </p>
                            <div className="flex justify-center space-x-4">
                                <Button onClick={() => setCurrentView('portfolio')}>Build a Portfolio</Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </>
    );
};
interface StatCardProps {
    title: string; value: string; onClick?: () => void; children?: React.ReactNode;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, onClick, children }) => (
    <Card className={`text-center transition-shadow hover:shadow-xl dark:hover:shadow-blue-900/50 ${onClick && 'cursor-pointer'}`} onClick={onClick}>
        <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">{title}</h4>
        <div className="flex items-baseline justify-center gap-2">
            <p className="text-3xl font-bold text-brand-primary">{value}</p>
            {children}
        </div>
    </Card>
);

export default DashboardView;
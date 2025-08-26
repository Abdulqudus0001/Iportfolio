import React, { useMemo } from 'react';
import { OptimizationResult } from '../../types';
import InfoIcon from '../ui/InfoIcon';
import Tooltip from '../ui/Tooltip';
import { useUserTier } from '../../context/UserTierContext';
import { UserTier } from '../../types';

interface PortfolioHealthCheckProps {
  portfolio: OptimizationResult;
}

const PortfolioHealthCheck: React.FC<PortfolioHealthCheckProps> = ({ portfolio }) => {
  const { tier } = useUserTier();

  const healthStats = useMemo(() => {
    const sectors = new Set(portfolio.weights.map(a => a.sector));
    const countries = new Set(portfolio.weights.map(a => a.country));
    const numAssets = portfolio.weights.length;

    let score: 'Good' | 'Fair' | 'Needs Improvement';
    let description: string;

    if (sectors.size >= 5 && countries.size >= 3 && numAssets >= 10) {
      score = 'Good';
      description = "This portfolio shows good diversification across various sectors and countries, which can help manage risk.";
    } else if (sectors.size >= 3 || countries.size >= 2) {
      score = 'Fair';
      description = "There is some diversification, but consider adding assets from more sectors or regions to improve risk distribution.";
    } else {
      score = 'Needs Improvement';
      description = "This portfolio is highly concentrated. Increasing the number of assets across different sectors is recommended to reduce risk.";
    }

    const sectorWeights: Record<string, number> = {};
    portfolio.weights.forEach(asset => {
        sectorWeights[asset.sector] = (sectorWeights[asset.sector] || 0) + asset.weight;
    });

    const topSectors = Object.entries(sectorWeights)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
    
    // Calculate Risk Score for Basic Tier
    const volatility = portfolio.volatility; // Annualized stdev
    let riskScore = 5; // Start at moderate
    if (volatility > 0.35) riskScore = 9;
    else if (volatility > 0.28) riskScore = 8;
    else if (volatility > 0.22) riskScore = 7;
    else if (volatility > 0.18) riskScore = 6;
    else if (volatility < 0.10) riskScore = 3;
    else if (volatility < 0.13) riskScore = 4;
    
    // Adjust score based on crypto exposure
    const cryptoWeight = portfolio.weights.filter(a => a.asset_class === 'CRYPTO').reduce((sum, a) => sum + a.weight, 0);
    if (cryptoWeight > 0.2) riskScore = Math.min(10, riskScore + 2);
    else if (cryptoWeight > 0.1) riskScore = Math.min(10, riskScore + 1);


    return { score, description, topSectors, riskScore };
  }, [portfolio]);

  const scoreColors = {
      'Good': 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300',
      'Fair': 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300',
      'Needs Improvement': 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300'
  };

  const getRiskScoreColor = (score: number) => {
      if (score >= 8) return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      if (score >= 5) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
  }

  return (
    <div className={`grid grid-cols-1 ${tier === UserTier.Basic ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6 items-center p-4 rounded-lg bg-light-bg dark:bg-dark-bg`}>
        {tier === UserTier.Basic && (
            <div className="text-center">
                 <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Risk Score</h4>
                <div className={`px-4 py-2 rounded-full inline-block font-bold text-lg ${getRiskScoreColor(healthStats.riskScore)}`}>
                    {healthStats.riskScore} / 10
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">A simple measure of your portfolio's overall risk level. Higher scores indicate higher potential risk and volatility.</p>
            </div>
        )}
        <div className="text-center">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Diversification Score</h4>
            <div className={`px-4 py-2 rounded-full inline-block font-bold text-lg ${scoreColors[healthStats.score]}`}>
                {healthStats.score}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{healthStats.description}</p>
        </div>
        <div className={tier === UserTier.Basic ? '' : 'md:col-span-2'}>
             <div className="flex items-center mb-2">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-2">Top Sector Exposures</h4>
                <Tooltip text="This shows the percentage of your portfolio invested in the top 3 sectors. High concentration in a single sector can increase risk.">
                    <InfoIcon />
                </Tooltip>
             </div>
             <div className="space-y-2">
                {healthStats.topSectors.map(([sector, weight]) => (
                    <div key={sector}>
                        <div className="flex justify-between mb-1 text-sm">
                            <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">{sector}</span>
                            <span className="font-semibold text-brand-primary">{((weight || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div className="bg-brand-secondary h-2.5 rounded-full" style={{ width: `${(weight || 0) * 100}%` }}></div>
                        </div>
                    </div>
                ))}
             </div>
        </div>
    </div>
  );
};

export default PortfolioHealthCheck;
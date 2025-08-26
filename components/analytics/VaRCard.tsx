import React, { useState, useEffect } from 'react';
import { OptimizationResult, VaRResult } from '../../types';
import { portfolioService } from '../../services/portfolioService';
import Loader from '../ui/Loader';
import Tooltip from '../ui/Tooltip';
import InfoIcon from '../ui/InfoIcon';
import { getCurrencySymbol } from '../../utils';


interface VaRCardProps {
  portfolio: OptimizationResult;
}

const VaRCard: React.FC<VaRCardProps> = ({ portfolio }) => {
  const [result, setResult] = useState<VaRResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currencySymbol = getCurrencySymbol(portfolio.currency);

  useEffect(() => {
    setIsLoading(true);
    portfolioService.calculateVaR(portfolio)
      .then(setResult)
      .finally(() => setIsLoading(false));
  }, [portfolio]);

  if (isLoading) return <Loader message="Calculating VaR..." />;
  if (!result) return <p>Could not calculate VaR.</p>;

  return (
    <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
            Based on historical simulation of a <span className="font-bold">{currencySymbol}{result.portfolioValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span> portfolio, over a 1-day period:
        </p>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                    <span>95% VaR</span>
                     <Tooltip text="Value at Risk (VaR). There is a 5% probability that the portfolio could lose at least this amount in a single day.">
                        <InfoIcon />
                    </Tooltip>
                </div>
                <span className="font-bold text-lg text-red-600">
                    {currencySymbol}{result.var95.toFixed(2)}
                </span>
            </div>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                    <span>95% CVaR</span>
                     <Tooltip text="Conditional VaR (CVaR). If the portfolio loss exceeds the VaR amount, this is the expected average loss.">
                        <InfoIcon />
                    </Tooltip>
                </div>
                <span className="font-bold text-lg text-red-700">
                    {currencySymbol}{result.cvar95.toFixed(2)}
                </span>
            </div>
        </div>
    </div>
  );
};

export default VaRCard;
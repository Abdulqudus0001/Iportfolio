import React, { useState, useEffect } from 'react';
import { OptimizationResult, TaxLossHarvestingResult } from '../types';
import Modal from './ui/Modal';
import Loader from './ui/Loader';
import { portfolioService } from '../services/portfolioService';
import { getCurrencySymbol } from '../utils';

interface TaxLossHarvestingViewProps {
  portfolio: OptimizationResult;
  onClose: () => void;
}

const TaxLossHarvestingView: React.FC<TaxLossHarvestingViewProps> = ({ portfolio, onClose }) => {
  const [result, setResult] = useState<TaxLossHarvestingResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currencySymbol = getCurrencySymbol(portfolio.currency);

  useEffect(() => {
    portfolioService.simulateTaxLossHarvesting(portfolio)
      .then(setResult)
      .finally(() => setIsLoading(false));
  }, [portfolio]);

  return (
    <Modal isOpen={true} onClose={onClose} title="Tax-Loss Harvesting Simulator">
      {isLoading ? (
        <Loader message="Analyzing harvesting opportunities..." />
      ) : result ? (
        <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg text-center">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-200">Potential Tax Savings</h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-300">{currencySymbol}{result.potentialTaxSavings.toFixed(2)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on harvesting all candidates at a 15% capital gains rate. (Simulation only)</p>
            </div>
          
            <div>
                <h3 className="font-semibold mb-2">Harvesting Candidates</h3>
                {result.candidates.length > 0 ? (
                     <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {result.candidates.map(candidate => (
                            <li key={candidate.ticker} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <span className="font-bold text-brand-primary">{candidate.ticker}</span>
                                <div className="text-right">
                                    <span className="text-red-600 font-semibold">-{currencySymbol}{candidate.unrealizedLoss.toFixed(2)}</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Unrealized Loss</span>
                                </div>
                            </li>
                        ))}
                     </ul>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">No significant loss-harvesting opportunities found in this simulation.</p>
                )}
            </div>
        </div>
      ) : (
        <p>Could not load tax-loss harvesting data.</p>
      )}
    </Modal>
  );
};

export default TaxLossHarvestingView;
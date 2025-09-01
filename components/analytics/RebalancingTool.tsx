import React, { useState } from 'react';
import { OptimizationResult, PortfolioTemplate } from '../../types';
import Button from '../ui/Button';

interface RebalancingToolProps {
  portfolio: OptimizationResult;
}

const RebalancingTool: React.FC<RebalancingToolProps> = ({ portfolio }) => {
  const [targetTemplate, setTargetTemplate] = useState<PortfolioTemplate>(PortfolioTemplate.Balanced);
  
  return (
    <div className="space-y-4 p-4 border-t dark:border-gray-700 mt-4">
      <h3 className="text-xl font-semibold text-brand-primary">Actionable Rebalancing</h3>
      <div className="flex items-end gap-4">
        <div className="flex-grow">
          <label htmlFor="target-template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Strategy</label>
          <select
            id="target-template"
            value={targetTemplate}
            onChange={(e) => setTargetTemplate(e.target.value as PortfolioTemplate)}
            disabled={true}
            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600 disabled:opacity-50"
          >
            {Object.values(PortfolioTemplate).filter(t => t !== PortfolioTemplate.Custom).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Button disabled={true}>Generate Plan</Button>
      </div>

      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg mt-2">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          The rebalancing tool is currently undergoing an upgrade to improve trade calculations and will be available again shortly.
        </p>
      </div>
    </div>
  );
};

export default RebalancingTool;
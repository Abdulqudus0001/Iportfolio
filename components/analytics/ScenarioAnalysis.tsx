import React, { useState, useMemo, useEffect } from 'react';
import { OptimizationResult, Scenario, ScenarioResult } from '../../types';
import { SCENARIOS } from '../../constants';
import { portfolioService } from '../../services/portfolioService';
import Loader from '../ui/Loader';
import Button from '../ui/Button';
import { useUserTier } from '../../context/UserTierContext';
import { UserTier } from '../../types';


interface ScenarioAnalysisProps {
  portfolio: OptimizationResult;
}

const ScenarioAnalysis: React.FC<ScenarioAnalysisProps> = ({ portfolio }) => {
  const { tier } = useUserTier();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIOS[0].id);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customImpacts, setCustomImpacts] = useState<Record<string, number>>({});

  const portfolioSectors = useMemo(() => {
    return [...new Set(portfolio.weights.map(a => a.sector))];
  }, [portfolio]);

  useEffect(() => {
    // Initialize custom impacts when sectors change
    const initialImpacts: Record<string, number> = {};
    portfolioSectors.forEach(sector => {
        initialImpacts[sector] = 1.0;
    });
    setCustomImpacts(initialImpacts);
  }, [portfolioSectors]);

  const runAnalysis = async () => {
    setIsLoading(true);
    setResult(null);
    
    let scenario: Scenario;
    if (selectedScenarioId === 'custom') {
        scenario = {
            id: 'custom',
            name: 'Custom Scenario',
            description: 'A user-defined market scenario.',
            impact: customImpacts
        };
    } else {
        const foundScenario = SCENARIOS.find(s => s.id === selectedScenarioId);
        if (!foundScenario) {
            setIsLoading(false);
            return;
        };
        scenario = foundScenario;
    }

    try {
      const scenarioResult = await portfolioService.runScenarioAnalysis(portfolio, scenario);
      setResult(scenarioResult);
    } catch (error) {
      console.error("Scenario analysis failed:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const selectedScenario = SCENARIOS.find(s => s.id === selectedScenarioId);

  const handleSliderChange = (sector: string, value: string) => {
      setCustomImpacts(prev => ({ ...prev, [sector]: parseFloat(value) }));
  };

  const renderCustomBuilder = () => (
      <div className="space-y-4 pt-4 mt-4 border-t dark:border-gray-600 max-h-60 overflow-y-auto pr-2">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300">Custom Scenario Builder</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Adjust the sliders to model the performance impact on each sector in your portfolio.</p>
          <div className="space-y-3">
              {portfolioSectors.map(sector => (
                <div key={sector}>
                  <label className="block text-sm">{sector}: <span className="font-bold">{formatPercent((customImpacts[sector] || 1) - 1)}</span></label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05" 
                    value={customImpacts[sector] || 1} 
                    onChange={(e) => handleSliderChange(sector, e.target.value)} 
                    className="w-full" 
                  />
                </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
            <label htmlFor="scenario-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select a Market Scenario</label>
            <select
                id="scenario-select"
                value={selectedScenarioId}
                onChange={e => setSelectedScenarioId(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
            >
                {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {tier === UserTier.Advanced && <option value="custom">Custom Scenario</option>}
            </select>
        </div>
        <Button onClick={runAnalysis} disabled={isLoading} className="w-full">
            Run Analysis
        </Button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedScenarioId === 'custom' ? 'Model a custom market event using the sliders below.' : selectedScenario?.description}</p>
      
      {selectedScenarioId === 'custom' && tier === UserTier.Advanced && renderCustomBuilder()}

      {isLoading && <Loader message="Analyzing scenario impact..." />}
      
      {result && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg grid grid-cols-3 gap-4 text-center">
            <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400">Original Return</h4>
                <p className="text-xl font-bold">{formatPercent(result.originalReturn)}</p>
            </div>
            <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400">Scenario Return</h4>
                <p className="text-xl font-bold">{formatPercent(result.scenarioReturn)}</p>
            </div>
             <div>
                <h4 className="text-sm text-gray-500 dark:text-gray-400">Estimated Impact</h4>
                <p className={`text-xl font-bold ${result.impactPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(result.impactPercentage)}
                </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioAnalysis;
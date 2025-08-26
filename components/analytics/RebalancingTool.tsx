import React, { useState } from 'react';
import { OptimizationResult, PortfolioTemplate, OptimizationModel } from '../../types';
import { portfolioService } from '../../services/portfolioService';
import { marketDataService } from '../../services/marketDataService';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import Modal from '../ui/Modal';
import { getCurrencySymbol } from '../../utils';

interface RebalancingToolProps {
  portfolio: OptimizationResult;
}

type RebalancePlan = { ticker: string; action: 'BUY' | 'SELL'; amount: string }[];
type ExecutableTrade = { ticker: string; action: 'BUY' | 'SELL'; shares: number; value: number };

const RebalancingTool: React.FC<RebalancingToolProps> = ({ portfolio }) => {
  const [targetTemplate, setTargetTemplate] = useState<PortfolioTemplate>(PortfolioTemplate.Balanced);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [trades, setTrades] = useState<ExecutableTrade[] | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const currencySymbol = getCurrencySymbol(portfolio.currency);
  const totalPortfolioValue = 10000;

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setPlan(null);
    setTrades(null);
    try {
        const targetPortfolioResult = await portfolioService.generateAndOptimizePortfolio(targetTemplate, OptimizationModel.MaximizeSharpe, 'optimize', portfolio.currency || 'USD');
        const targetPortfolio = targetPortfolioResult.bestSharpe;
        const rebalancePlan = await portfolioService.generateRebalancePlan(portfolio, targetPortfolio.weights);
        setPlan(rebalancePlan);
    } catch (error) {
        console.error("Error generating rebalance plan:", error);
        alert("Could not generate rebalancing plan.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleShowTrades = async () => {
      if (!plan) return;
      setIsLoading(true);
      try {
          const tickers = plan.map(p => p.ticker);
          const priceSummaries = await Promise.all(tickers.map(t => marketDataService.getAssetPriceSummary(t)));
          
          const executableTrades = plan.map((p, i) => {
              const price = priceSummaries[i]?.data.close;
              if (!price || price === 0) return null;
              
              const value = parseFloat(p.amount.replace(/[^0-9.-]+/g,""));
              const shares = value / price;

              return { ticker: p.ticker, action: p.action, shares, value };
          }).filter((t): t is ExecutableTrade => t !== null);

          setTrades(executableTrades);
          setIsTradeModalOpen(true);
      } catch (error) {
          console.error("Error calculating trades:", error);
          alert("Could not fetch current prices to calculate exact trades.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <>
    {isTradeModalOpen && trades && (
        <Modal isOpen={true} onClose={() => setIsTradeModalOpen(false)} title="Trade Execution Plan">
            <div className="space-y-3">
                <p className="text-sm text-gray-500">This is a simulated trade list based on a {currencySymbol}{totalPortfolioValue.toLocaleString()} portfolio to align with the '{targetTemplate}' strategy.</p>
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {trades.map(trade => (
                         <li key={trade.ticker} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-md ${trade.action === 'BUY' ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'}`}>
                            <span className={`font-bold col-span-1 ${trade.action === 'BUY' ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>{trade.action}</span>
                            <span className="font-medium col-span-1">{trade.ticker}</span>
                            <span className="font-mono text-right col-span-1">{trade.shares.toFixed(4)} shares</span>
                            <span className="font-mono text-right col-span-1">({currencySymbol}{trade.value.toFixed(2)})</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    )}
    <div className="space-y-4 p-4 border-t dark:border-gray-700 mt-4">
      <h3 className="text-xl font-semibold text-brand-primary">Actionable Rebalancing</h3>
      <div className="flex items-end gap-4">
        <div className="flex-grow">
          <label htmlFor="target-template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Strategy</label>
          <select
            id="target-template"
            value={targetTemplate}
            onChange={(e) => setTargetTemplate(e.target.value as PortfolioTemplate)}
            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
          >
            {Object.values(PortfolioTemplate).filter(t => t !== PortfolioTemplate.Custom).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Button onClick={handleGeneratePlan} disabled={isLoading}>Generate Plan</Button>
      </div>

      {isLoading && <Loader message="Calculating rebalancing plan..." />}
      
      {plan && (
        <div>
          <h4 className="font-semibold mt-4 mb-2">Recommended Trades (for a {currencySymbol}{totalPortfolioValue.toLocaleString()} portfolio)</h4>
          {plan.length > 0 ? (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {plan.map(item => (
                <li key={item.ticker} className={`flex justify-between items-center p-2 rounded-md ${item.action === 'BUY' ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'}`}>
                  <div>
                    <span className={`font-bold ${item.action === 'BUY' ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>{item.action}</span>
                    <span className="ml-2 font-medium">{item.ticker}</span>
                  </div>
                  <span className="font-semibold">{item.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400">Your portfolio is already closely aligned with the target strategy. No rebalancing needed.</p>
          )}
           {plan.length > 0 && (
              <Button onClick={handleShowTrades} disabled={isLoading} variant="secondary" className="w-full mt-3">
                  Show Exact Trades
              </Button>
            )}
        </div>
      )}
    </div>
    </>
  );
};

export default RebalancingTool;
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { portfolioService } from '../services/portfolioService';
import { BacktestResult, OptimizationResult } from '../types';
import Button from './ui/Button';
import Loader from './ui/Loader';
import { useUserTier } from '../context/UserTierContext';
import { UserTier } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getCurrencySymbol } from '../utils';

interface BacktestingViewProps {
  portfolio: OptimizationResult;
}

const BacktestingView: React.FC<BacktestingViewProps> = ({ portfolio }) => {
  const { tier } = useUserTier();
  const { theme } = useTheme();
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'1y' | '3y' | '5y'>('1y');
  const [benchmark, setBenchmark] = useState('SPY');

  const isProOrHigher = tier === UserTier.Professional || tier === UserTier.Advanced;
  const currencySymbol = getCurrencySymbol(portfolio.currency);

  const runBacktest = async () => {
    if (!isProOrHigher && timeframe !== '1y') {
        alert("Custom timeframes are a Professional feature.");
        return;
    }
    setIsLoading(true);
    try {
      const result = await portfolioService.runBacktest(portfolio, timeframe, benchmark);
      setBacktestResult(result);
    } catch (error) {
      console.error("Backtest failed:", error);
      alert("An error occurred during the backtest.");
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = backtestResult?.dates.map((date, i) => ({
    date,
    Portfolio: backtestResult.portfolioValues[i],
    Benchmark: backtestResult.benchmarkValues[i],
  }));

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

    const colors = {
        light: { grid: '#ccc', text: '#212529', portfolioLine: '#0D47A1', benchmarkLine: '#FF5722' },
        dark: { grid: '#444', text: '#E0E0E0', portfolioLine: '#42A5F5', benchmarkLine: '#FF8A65' }
    };
    const themeColors = colors[theme];

  return (
    <div className="space-y-4">
      {!backtestResult && !isLoading && (
        <div className="text-center p-8 border-dashed border-2 rounded-lg dark:border-gray-600">
          <h3 className="text-lg font-semibold text-brand-secondary">Run Historical Backtest</h3>
          <p className="text-gray-600 dark:text-gray-400 my-2">
            See how your optimized portfolio would have performed against a benchmark.
          </p>
          {isProOrHigher && (
              <div className="flex justify-center gap-4 my-4 items-center">
                  <div>
                    <label className="text-sm mr-2">Timeframe:</label>
                    <select value={timeframe} onChange={e => setTimeframe(e.target.value as any)} className="p-1 border rounded bg-inherit dark:bg-dark-card dark:border-gray-500">
                        <option value="1y">1 Year</option>
                        <option value="3y">3 Years</option>
                        <option value="5y">5 Years</option>
                    </select>
                  </div>
                   <div>
                    <label className="text-sm mr-2">Benchmark:</label>
                    <select value={benchmark} onChange={e => setBenchmark(e.target.value)} className="p-1 border rounded bg-inherit dark:bg-dark-card dark:border-gray-500">
                        <option value="SPY">S&P 500 (SPY)</option>
                        <option value="QQQ">Nasdaq 100 (QQQ)</option>
                    </select>
                  </div>
              </div>
          )}
          <Button onClick={runBacktest} disabled={tier === UserTier.Basic}>
            Run Backtest
          </Button>
        </div>
      )}
      {isLoading && <Loader message="Running backtest simulation..." />}
      {backtestResult && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm text-gray-500 dark:text-gray-400">Portfolio Return</h4>
                    <p className={`text-xl font-bold ${backtestResult.totalReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(backtestResult.totalReturn)}
                    </p>
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm text-gray-500 dark:text-gray-400">Benchmark Return</h4>
                    <p className={`text-xl font-bold ${backtestResult.benchmarkReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(backtestResult.benchmarkReturn)}
                    </p>
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</h4>
                    <p className="text-xl font-bold text-red-600">
                        {formatPercent(backtestResult.maxDrawdown)}
                    </p>
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm text-gray-500 dark:text-gray-400">Relative Performance</h4>
                    <p className={`text-xl font-bold ${backtestResult.totalReturn > backtestResult.benchmarkReturn ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(backtestResult.totalReturn - backtestResult.benchmarkReturn)}
                    </p>
                </div>
          </div>

          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid}/>
                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} stroke={themeColors.text}/>
                <YAxis tickFormatter={(tick) => `${currencySymbol}${tick.toLocaleString()}`} stroke={themeColors.text}/>
                <Tooltip 
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#333' : '#fff', borderColor: themeColors.grid }}
                    formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`} />
                <Legend wrapperStyle={{color: themeColors.text}} />
                <Line type="monotone" dataKey="Portfolio" stroke={themeColors.portfolioLine} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Benchmark" stroke={themeColors.benchmarkLine} strokeWidth={2} dot={false} name={benchmark} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default BacktestingView;
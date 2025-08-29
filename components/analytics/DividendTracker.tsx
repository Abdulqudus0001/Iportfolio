import React, { useState, useEffect } from 'react';
import { OptimizationResult, DividendInfo } from '../../types';
import { marketDataService } from '../../services/marketDataService';
import Loader from '../ui/Loader';

interface DividendTrackerProps {
  portfolio: OptimizationResult;
}

const DividendTracker: React.FC<DividendTrackerProps> = ({ portfolio }) => {
  const [dividendData, setDividendData] = useState<DividendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAnnualIncome, setTotalAnnualIncome] = useState(0);
  const totalPortfolioValue = 10000; // Assume a $10,000 portfolio for calculation

  useEffect(() => {
    const fetchDividends = async () => {
      setLoading(true);
      const dividendPayers = portfolio.weights.filter(a => a.asset_class === 'EQUITY');
      const promises = dividendPayers.map(a => marketDataService.getDividendInfo(a.ticker));
      const results = await Promise.allSettled(promises);
      
      const validData: DividendInfo[] = [];
      let totalIncome = 0;

      results.forEach((res, index) => {
        if (res.status === 'fulfilled' && res.value?.data) {
          const dividendInfo = res.value.data;
          const assetWeight = dividendPayers[index].weight;
          const assetValue = totalPortfolioValue * assetWeight;
          const projectedIncome = assetValue * (dividendInfo.yield ?? 0);
          
          dividendInfo.projectedAnnualIncome = projectedIncome;
          totalIncome += projectedIncome;
          validData.push(dividendInfo);
        }
      });

      setDividendData(validData);
      setTotalAnnualIncome(totalIncome);
      setLoading(false);
    };

    fetchDividends();
  }, [portfolio]);

  if (loading) return <div className="mt-4"><Loader message="Fetching dividend data..." /></div>;
  if (dividendData.length === 0) return <p className="text-center text-gray-500 mt-4">No dividend-paying stocks found in this portfolio.</p>;

  return (
    <div className="space-y-4 mt-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg text-center">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-200">Projected Annual Dividend Income</h4>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">${(totalAnnualIncome ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on a ${totalPortfolioValue.toLocaleString()} portfolio value.</p>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-4 py-2 text-left">Ticker</th>
                        <th className="px-4 py-2 text-right">Yield</th>
                        <th className="px-4 py-2 text-right">Last Dividend</th>
                        <th className="px-4 py-2 text-left">Pay Date</th>
                        <th className="px-4 py-2 text-right">Income</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {dividendData.map(d => (
                        <tr key={d.ticker}>
                            <td className="px-4 py-2 font-medium">{d.ticker}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-600">{(((d.yield ?? 0) * 100).toFixed(2))}%</td>
                            <td className="px-4 py-2 text-right">${(d.amountPerShare ?? 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-left">{new Date(d.payDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right font-semibold">${(d.projectedAnnualIncome ?? 0).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default DividendTracker;
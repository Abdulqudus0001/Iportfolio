import React, { useState, useEffect } from 'react';
import { Asset, CorrelationData, Currency, DataSource } from '../../types';
import { portfolioService } from '../../services/portfolioService';
import Loader from '../ui/Loader';
import WarningBanner from '../ui/WarningBanner';

interface CorrelationMatrixProps {
  assets: Asset[];
  currency: Currency;
}

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ assets, currency }) => {
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<DataSource>('live');

  useEffect(() => {
    if (assets.length > 1) {
      setLoading(true);
      portfolioService.getCorrelationMatrix(assets, currency)
        .then(data => {
          setCorrelationData(data);
          setSource(data.source);
          setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    } else {
        setLoading(false);
        setCorrelationData({ assets: assets.map(a => a.ticker), matrix: [] });
    }
  }, [assets, currency]);

  const getColor = (value: number) => {
    const alpha = Math.abs(value);
    if (value > 0) return `rgba(76, 175, 80, ${alpha})`; // Green for positive
    return `rgba(244, 67, 54, ${alpha})`; // Red for negative
  };

  if (loading) return <Loader message="Calculating correlations..." />;
  if (!correlationData) return <p className="text-center">Could not calculate correlation matrix.</p>;

  if (correlationData.matrix.length === 0) {
      return (
        <div className="text-center p-4">
            <p className="font-semibold">Could not generate correlation matrix.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">This feature requires at least two assets with available historical data.</p>
            {correlationData.assets.length > 0 && 
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Data was only found for: {correlationData.assets.join(', ')}</p>
            }
        </div>
      );
  }

  return (
    <div className="space-y-4">
        {source === 'static' &&
            <WarningBanner 
                source="static"
                message="Correlations are calculated using static demo data."
            />
        }
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead>
                <tr>
                    <th className="sticky left-0 bg-light-card dark:bg-dark-card p-2 border dark:border-gray-600"></th>
                    {correlationData.assets.map(ticker => (
                    <th key={ticker} className="p-2 border dark:border-gray-600 font-bold">{ticker}</th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {correlationData.matrix.map((row, i) => (
                    <tr key={i}>
                    <td className="sticky left-0 bg-light-card dark:bg-dark-card p-2 border dark:border-gray-600 font-bold">{correlationData.assets[i]}</td>
                    {row.map((cell, j) => (
                        <td
                        key={j}
                        className="p-2 border dark:border-gray-600 text-center text-white font-semibold"
                        style={{ backgroundColor: getColor(cell) }}
                        title={`${correlationData.assets[i]} / ${correlationData.assets[j]}: ${cell.toFixed(3)}`}
                        >
                        {cell.toFixed(2)}
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
            <div className="flex items-center justify-center space-x-4 mt-2 text-xs">
                <div className="flex items-center"><div className="w-3 h-3 mr-1 bg-red-500"></div> Negative Correlation</div>
                <div className="flex items-center"><div className="w-3 h-3 mr-1 bg-green-500"></div> Positive Correlation</div>
            </div>
        </div>
    </div>
  );
};

export default CorrelationMatrix;
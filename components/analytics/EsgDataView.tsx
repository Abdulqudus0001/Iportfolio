import React, { useState, useEffect } from 'react';
import { marketDataService } from '../../services/marketDataService';
import { EsgData } from '../../types';
import Loader from '../ui/Loader';

interface EsgDataViewProps {
  ticker: string;
}

const EsgDataView: React.FC<EsgDataViewProps> = ({ ticker }) => {
  const [data, setData] = useState<EsgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    marketDataService.getEsgData(ticker)
      .then(response => setData(response.data))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <Loader message="Loading ESG data..." />;
  if (!data) return <p className="text-xs text-center text-gray-500">ESG data not available for this asset.</p>;

  const ScoreBar: React.FC<{ score: number; label: string }> = ({ score, label }) => (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{score.toFixed(2)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div className="bg-green-600 h-2 rounded-full" style={{ width: `${(score / 50) * 100}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall ESG Score</h4>
        <p className="text-3xl font-bold text-brand-primary">{data.totalScore.toFixed(2)}</p>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{data.rating} Risk</p>
      </div>
      <div className="space-y-3">
        <ScoreBar score={data.eScore} label="Environmental" />
        <ScoreBar score={data.sScore} label="Social" />
        <ScoreBar score={data.gScore} label="Governance" />
      </div>
    </div>
  );
};

export default EsgDataView;
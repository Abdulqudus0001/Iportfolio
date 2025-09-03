
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { marketDataService } from '../services/marketDataService';
import { PriceDataPoint } from '../types';
import Loader from './ui/Loader';
import { useTheme } from '../context/ThemeContext';

interface PriceChartProps {
  ticker: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ ticker }) => {
  const [data, setData] = useState<PriceDataPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const colors = {
    light: { grid: '#ccc', text: '#212529', line: '#0D47A1' },
    dark: { grid: '#444', text: '#E0E0E0', line: '#42A5F5' }
  };
  const themeColors = colors[theme];

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    marketDataService.getAssetPriceHistory(ticker, '1y')
      .then((priceData) => {
        if (priceData.length === 0) {
            throw new Error("No historical data available for this asset.");
        }
        setData(priceData);
      })
      .catch((err) => {
        console.error(err);
        setError(`Could not load price data for ${ticker}.`);
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <Loader message="Loading chart data..." />;
  if (error) return <p className="text-red-500 text-center py-10">{error}</p>;
  if (!data) return <p>No data available.</p>;

  return (
    <div className="relative" style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
            <XAxis dataKey="date" stroke={themeColors.text} />
            <YAxis domain={['dataMin', 'dataMax']} tickFormatter={(tick) => `$${tick.toFixed(2)}`} stroke={themeColors.text} />
            <Tooltip
                contentStyle={{ backgroundColor: theme === 'dark' ? '#333' : '#fff', borderColor: themeColors.grid }}
                itemStyle={{ color: themeColors.text }}
                formatter={(value: number) => `$${value.toFixed(2)}`} 
            />
            <Legend wrapperStyle={{color: themeColors.text}}/>
            <Line type="monotone" dataKey="price" stroke={themeColors.line} strokeWidth={2} dot={false} name={ticker} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default PriceChart;


import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';
import { SimulationPoint, OptimizationResult } from '../types';

interface EfficientFrontierChartProps {
  simulations: SimulationPoint[];
  optimalPoint: OptimizationResult | null;
}

const EfficientFrontierChart: React.FC<EfficientFrontierChartProps> = ({ simulations, optimalPoint }) => {
  const formattedOptimalPoint = optimalPoint ? [{
    volatility: optimalPoint.volatility,
    returns: optimalPoint.returns,
    sharpeRatio: optimalPoint.sharpeRatio,
  }] : [];
  
  return (
    <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="volatility" name="Volatility" unit="%" tickFormatter={(tick) => `${(tick * 100).toFixed(1)}%`} />
                <YAxis type="number" dataKey="returns" name="Return" unit="%" tickFormatter={(tick) => `${(tick * 100).toFixed(1)}%`} />
                <ZAxis type="number" dataKey="sharpeRatio" range={[20, 200]} name="Sharpe Ratio" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => (name === 'Volatility' || name === 'Return' ? `${(value * 100).toFixed(2)}%` : value.toFixed(3))} />
                <Legend />
                <Scatter name="Simulated Portfolios" data={simulations} fill="#8884d8" shape="circle" fillOpacity={0.5} />
                <Scatter name="Optimal Portfolio (Best Sharpe)" data={formattedOptimalPoint} fill="#ff7300" shape="star" />
            </ScatterChart>
        </ResponsiveContainer>
    </div>
  );
};

export default EfficientFrontierChart;
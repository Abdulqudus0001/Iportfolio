import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { OptimizationResult } from '../../types';

interface PortfolioCompositionChartsProps {
  portfolio: OptimizationResult;
}

const COLORS = ['#0D47A1', '#1976D2', '#42A5F5', '#90CAF9', '#1E88E5', '#64B5F6', '#0277BD', '#29B6F6', '#039BE5', '#4FC3F7', '#B3E5FC'];

const PortfolioCompositionCharts: React.FC<PortfolioCompositionChartsProps> = ({ portfolio }) => {

  const dataByAsset = useMemo(() => {
    return portfolio.weights.map(asset => ({
      name: asset.ticker,
      value: parseFloat((asset.weight * 100).toFixed(2)),
    })).sort((a, b) => a.value - b.value); // Sort for better bar chart presentation
  }, [portfolio]);

  const dataBySector = useMemo(() => {
    const sectorMap = new Map<string, number>();
    portfolio.weights.forEach(asset => {
      const currentWeight = sectorMap.get(asset.sector) || 0;
      sectorMap.set(asset.sector, currentWeight + asset.weight);
    });
    return Array.from(sectorMap.entries()).map(([name, weight]) => ({
      name,
      value: parseFloat((weight * 100).toFixed(2)),
    }));
  }, [portfolio]);

  const dataByCountry = useMemo(() => {
    const countryMap = new Map<string, number>();
    portfolio.weights.forEach(asset => {
      const currentWeight = countryMap.get(asset.country) || 0;
      countryMap.set(asset.country, currentWeight + asset.weight);
    });
    return Array.from(countryMap.entries()).map(([name, weight]) => ({
      name,
      value: parseFloat((weight * 100).toFixed(2)),
    }));
  }, [portfolio]);

  const renderPieChart = (data: {name: string, value: number}[], title: string) => (
    <div className="w-full h-80 flex flex-col items-center">
        <h4 className="font-semibold text-brand-secondary">{title}</h4>
        <ResponsiveContainer>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="lg:col-span-2">
        <div className="w-full h-80 flex flex-col items-center">
            <h4 className="font-semibold text-brand-secondary">By Asset</h4>
            <ResponsiveContainer>
                <BarChart
                    layout="vertical"
                    data={dataByAsset}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="%" domain={[0, 'dataMax + 2']} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} cursor={{fill: 'rgba(238,238,238,0.5)'}} />
                    <Bar dataKey="value" name="Weight" fill="#0D47A1">
                        {dataByAsset.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
      {renderPieChart(dataBySector, 'By Sector')}
      {renderPieChart(dataByCountry, 'By Country')}
    </div>
  );
};

export default PortfolioCompositionCharts;

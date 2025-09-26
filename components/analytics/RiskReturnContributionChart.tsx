


import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OptimizationResult, ContributionData } from '../../types';
import { portfolioService } from '../../services/portfolioService';
import Loader from '../ui/Loader';
import { useTheme } from '../../context/ThemeContext';

interface RiskReturnContributionChartProps {
  portfolio: OptimizationResult;
}

const RiskReturnContributionChart: React.FC<RiskReturnContributionChartProps> = ({ portfolio }) => {
    const [contributionData, setContributionData] = useState<ContributionData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();

    useEffect(() => {
        if (portfolio.weights.length > 0) {
            setLoading(true);
            portfolioService.getRiskReturnContribution(portfolio)
                .then(data => {
                    setContributionData(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [portfolio]);

    if (loading) return <Loader message="Calculating contributions..." />;
    if (!contributionData) return <p className="text-center">Could not calculate contributions.</p>;

    if (contributionData.length === 0) {
        return <p className="text-center p-4 text-sm text-gray-500">Contribution analysis requires historical data, which was not available for the assets in this portfolio.</p>
    }
    
    const assetsWithNoData = portfolio.weights.filter(w => !contributionData.some(c => c.ticker === w.ticker));

    const themeColors = {
        light: { text: '#212529', bg: '#ffffff', border: '#cccccc' },
        dark: { text: '#E0E0E0', bg: '#1E1E1E', border: '#555' }
    };
    const currentColors = themeColors[theme];


    return (
        <div style={{ width: '100%', height: 300 }}>
             {assetsWithNoData.length > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mb-2">
                    Note: Contribution data could not be calculated for {assetsWithNoData.map(a => a.ticker).join(', ')}.
                </p>
            )}
            <ResponsiveContainer>
                <BarChart data={contributionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ticker" />
                    <YAxis tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} />
                    <Tooltip 
                        formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                        contentStyle={{
                            backgroundColor: currentColors.bg,
                            borderColor: currentColors.border,
                        }}
                        itemStyle={{ color: currentColors.text }}
                        labelStyle={{ color: currentColors.text, fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="returnContribution" fill="#1976D2" name="Return Contribution (%)" />
                    <Bar dataKey="riskContribution" fill="#F44336" name="Risk Contribution (%)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RiskReturnContributionChart;
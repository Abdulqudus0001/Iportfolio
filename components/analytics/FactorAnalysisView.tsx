import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { OptimizationResult, FactorExposures } from '../../types';
import { portfolioService } from '../../services/portfolioService';
import Loader from '../ui/Loader';
import Card from '../ui/Card';
import InfoIcon from '../ui/InfoIcon';
import TooltipUI from '../ui/Tooltip';
import { useTheme } from '../../context/ThemeContext';

interface FactorAnalysisViewProps {
  portfolio: OptimizationResult;
}

const factorDefinitions = {
    'Market (Beta)': "Measures the portfolio's sensitivity to overall market movements. A Beta > 1 suggests more volatility than the market; < 1 suggests less.",
    'Size (SMB)': "Measures exposure to small-cap stocks vs. large-cap stocks. A positive value indicates a tilt towards smaller companies.",
    'Value (HML)': "Measures exposure to value stocks (low price-to-book) vs. growth stocks (high price-to-book). A positive value indicates a tilt towards value."
};

const FactorAnalysisView: React.FC<FactorAnalysisViewProps> = ({ portfolio }) => {
    const [factors, setFactors] = useState<FactorExposures | null>(null);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();

    const colors = {
        light: { grid: '#ccc', text: '#212529' },
        dark: { grid: '#444', text: '#E0E0E0' }
    };
    const themeColors = colors[theme];


    useEffect(() => {
        setLoading(true);
        portfolioService.runFactorAnalysis(portfolio)
            .then(setFactors)
            .finally(() => setLoading(false));
    }, [portfolio]);

    if (loading) return <Card className="mt-4"><Loader message="Running factor analysis..." /></Card>;
    if (!factors) return <Card className="mt-4"><p>Could not perform factor analysis.</p></Card>;
    
    const data = [
        { name: 'Market (Beta)', value: factors.beta.toFixed(3) },
        { name: 'Size (SMB)', value: factors.smb.toFixed(3) },
        { name: 'Value (HML)', value: factors.hml.toFixed(3) },
    ];

    return (
        <Card className="mt-4">
             <div className="flex items-center mb-4">
                <h3 className="text-xl font-semibold text-brand-primary mr-2">Portfolio Factor Exposures</h3>
                <TooltipUI text="Decomposes portfolio returns based on common academic risk factors to understand what drives performance.">
                    <InfoIcon />
                </TooltipUI>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {data.map(item => (
                    <div key={item.name} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                            <span>{item.name}</span>
                            <TooltipUI text={factorDefinitions[item.name as keyof typeof factorDefinitions]}>
                                <InfoIcon />
                            </TooltipUI>
                        </div>
                        <p className="text-2xl font-bold text-brand-primary">{item.value}</p>
                    </div>
                ))}
            </div>
            <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
                        <XAxis type="number" stroke={themeColors.text} />
                        <YAxis type="category" dataKey="name" width={100} stroke={themeColors.text} />
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#333' : '#fff', borderColor: themeColors.grid }} />
                        <Bar dataKey="value" name="Factor Loading">
                           {data.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={parseFloat(entry.value) >= 0 ? '#1976D2' : '#F44336'} />
                           ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default FactorAnalysisView;
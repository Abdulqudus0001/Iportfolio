import React from 'react';
import { OptimizationResult } from '../../types';
import Card from '../ui/Card';
import InfoIcon from '../ui/InfoIcon';
import TooltipUI from '../ui/Tooltip';

interface FactorAnalysisViewProps {
  portfolio: OptimizationResult;
}

const FactorAnalysisView: React.FC<FactorAnalysisViewProps> = ({ portfolio }) => {
    return (
        <Card className="mt-4">
             <div className="flex items-center mb-4">
                <h3 className="text-xl font-semibold text-brand-primary mr-2">Fama-French 3-Factor Model</h3>
                <TooltipUI text="Decomposes portfolio returns based on common academic risk factors to understand what drives performance.">
                    <InfoIcon />
                </TooltipUI>
            </div>
            
            <div className="text-center p-8 border-dashed border-2 rounded-lg dark:border-gray-600">
                <h3 className="text-lg font-semibold text-brand-secondary">Feature in Development</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    Our advanced factor analysis module is being refined. Check back soon for deeper insights into what drives your portfolio's performance.
                </p>
            </div>
        </Card>
    );
};

export default FactorAnalysisView;
import React from 'react';

interface BacktestingViewProps {
  // The portfolio prop is kept for structural consistency, even though it's not used in this placeholder.
  portfolio: any; 
}

const BacktestingView: React.FC<BacktestingViewProps> = () => {
  return (
    <div className="space-y-4">
      <div className="text-center p-8 border-dashed border-2 rounded-lg dark:border-gray-600">
        <h3 className="text-lg font-semibold text-brand-secondary">Feature in Development</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
          Our historical backtesting engine is currently being upgraded to provide more accurate simulations across a wider range of market conditions. This feature will be available soon.
        </p>
      </div>
    </div>
  );
};

export default BacktestingView;
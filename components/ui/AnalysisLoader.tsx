import React, { useState, useEffect } from 'react';

const loadingSteps = [
  "Preparing your analysis...",
  "Gathering historical market data...",
  "Analyzing how your assets move together...",
  "Simulating thousands of potential market outcomes...",
  "Pinpointing the optimal risk-return balance...",
  "Compiling your portfolio report..."
];

const AnalysisLoader: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prevStep => (prevStep + 1) % loadingSteps.length);
    }, 2500); // Change step every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-brand-primary rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-brand-primary rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-brand-primary rounded-full animate-bounce delay-300"></div>
      </div>
      <p className="text-light-text-secondary text-center font-medium transition-opacity duration-500">
        {loadingSteps[currentStep]}
      </p>
    </div>
  );
};

export default AnalysisLoader;

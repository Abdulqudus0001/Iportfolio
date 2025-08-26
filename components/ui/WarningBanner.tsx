import React from 'react';

interface WarningBannerProps {
  message: string;
  source: 'cache' | 'static';
}

const WarningIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
);


const WarningBanner: React.FC<WarningBannerProps> = ({ message, source }) => {
    const isStatic = source === 'static';
    const bgColor = isStatic ? 'bg-red-50 dark:bg-red-900/50' : 'bg-yellow-50 dark:bg-yellow-900/50';
    const borderColor = isStatic ? 'border-red-200 dark:border-red-700' : 'border-yellow-200 dark:border-yellow-700';
    const textColor = isStatic ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200';

    return (
        <div className={`p-3 rounded-lg border ${bgColor} ${borderColor} ${textColor} flex items-center text-sm`}>
            <WarningIcon />
            <span>{message}</span>
        </div>
    );
};

export default WarningBanner;

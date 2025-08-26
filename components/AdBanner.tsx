import React from 'react';
import Card from './ui/Card';

interface AdBannerProps {
    type?: 'banner' | 'sidebar' | 'inline';
}

const AdBanner: React.FC<AdBannerProps> = ({ type = 'banner' }) => {
    if (type === 'sidebar') {
        return (
            <div className="bg-gray-100 dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center">
                 <h4 className="font-semibold text-gray-600 dark:text-gray-400 text-sm">Advertisement</h4>
                 <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Go Advanced for an ad-free experience.</p>
            </div>
        );
    }

    if (type === 'inline') {
        return (
             <div className="bg-gray-50 dark:bg-gray-800 border-dashed border-2 border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center my-4">
                <h4 className="font-semibold text-gray-500 dark:text-gray-400 text-xs">ADVERTISEMENT</h4>
            </div>
        )
    }

    return (
        <Card className="bg-gray-100 dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-600">
        <div className="text-center p-4">
            <h4 className="font-semibold text-gray-600 dark:text-gray-400">Advertisement Slot</h4>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Upgrade to a Professional or Advanced plan to remove ads and unlock more features.</p>
        </div>
        </Card>
    );
};

export default AdBanner;
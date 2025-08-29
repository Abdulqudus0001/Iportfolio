import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { usePortfolio } from '../context/PortfolioContext';
import { View } from '../types';

interface CommunityViewProps {
    setCurrentView: (view: View) => void;
}

const CommunityView: React.FC<CommunityViewProps> = ({ setCurrentView }) => {
    const { loadPortfolio } = usePortfolio();

    return (
        <div className="space-y-6">
            <Card>
                <div className="text-center py-24">
                    <h2 className="text-3xl font-bold text-brand-primary mb-4">Community Hub Coming Soon</h2>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto">
                        We're working on a feature that will allow you to share your own portfolio strategies and discover what others are building. Stay tuned for updates!
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default CommunityView;
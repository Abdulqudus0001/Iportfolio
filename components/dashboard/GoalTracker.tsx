import React, { useState } from 'react';
import Card from '../ui/Card';
import { useFinancialGoals } from '../../context/FinancialGoalsContext';
import Button from '../ui/Button';
import AddGoalModal from './AddGoalModal';

const GoalTracker: React.FC = () => {
    const { goals } = useFinancialGoals();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const hasGoals = goals.length > 0;

    return (
        <>
        <AddGoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <Card title="Goal Tracker" className="lg:col-span-1">
            {hasGoals ? (
                <div className="space-y-4">
                    {goals.slice(0, 2).map(goal => {
                        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                        return (
                            <div key={goal.id}>
                                <div className="flex justify-between mb-1 text-sm">
                                    <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">{goal.name}</span>
                                    <span className="font-semibold text-brand-primary">
                                        ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-brand-secondary h-2.5 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">
                                    Target Date: {new Date(goal.targetDate).toLocaleDateString()}
                                </p>
                            </div>
                        );
                    })}
                    <Button variant="secondary" className="w-full mt-2" onClick={() => setIsModalOpen(true)}>Manage Goals</Button>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">You haven't set any financial goals yet.</p>
                    <Button variant="secondary" onClick={() => setIsModalOpen(true)}>Add New Goal</Button>
                </div>
            )}
        </Card>
        </>
    );
};

export default GoalTracker;
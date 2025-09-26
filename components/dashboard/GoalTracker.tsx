import React, { useState } from 'react';
import Card from '../ui/Card';
import { useFinancialGoals } from '../../context/FinancialGoalsContext';
import Button from '../ui/Button';
import AddGoalModal from './AddGoalModal';
import { usePortfolio } from '../../context/PortfolioContext';
import { portfolioService } from '../../services/portfolioService';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Budget, FinancialGoal } from '../../types';
import Loader from '../ui/Loader';

const GoalTracker: React.FC = () => {
    const { goals, updateGoal } = useFinancialGoals();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { optimizationResult } = usePortfolio();
    const [budget] = useLocalStorage<Budget>('iportfolio-budget', { income: 0, expenses: 0 });
    const [loadingGoalId, setLoadingGoalId] = useState<string | null>(null);

    const hasGoals = goals.length > 0;
    
    const handleCalculateProbability = async (goal: FinancialGoal) => {
        if (!optimizationResult) return;
        setLoadingGoalId(goal.id);
        const annualContribution = (budget.income - budget.expenses) * 12;
        try {
            const result = await portfolioService.projectGoal(goal, optimizationResult, annualContribution);
            updateGoal({ ...goal, successProbability: result.successProbability });
        } catch (error) {
            console.error("Failed to project goal:", error);
            alert("Could not calculate goal probability. Please ensure your portfolio is active and try again.");
        } finally {
            setLoadingGoalId(null);
        }
    };

    return (
        <>
        <AddGoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <Card title="Goal Tracker">
            {hasGoals ? (
                <div className="space-y-4">
                    {goals.slice(0, 3).map(goal => {
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
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                                    </p>
                                    {optimizationResult && (
                                        loadingGoalId === goal.id ? <div className="w-20"><Loader message="" /></div> :
                                        goal.successProbability !== undefined ? 
                                            <p className={`text-xs font-bold ${goal.successProbability > 0.7 ? 'text-green-600' : goal.successProbability > 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {(goal.successProbability * 100).toFixed(0)}% Chance
                                            </p> :
                                            <button onClick={() => handleCalculateProbability(goal)} className="text-xs text-brand-secondary hover:underline">Calculate</button>
                                    )}
                                </div>
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
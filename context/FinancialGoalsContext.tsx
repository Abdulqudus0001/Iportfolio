
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { FinancialGoal } from '../types';

interface FinancialGoalsContextType {
  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id' | 'currentAmount'>) => void;
  updateGoal: (goal: FinancialGoal) => void;
  deleteGoal: (id: string) => void;
}

const FinancialGoalsContext = createContext<FinancialGoalsContextType | undefined>(undefined);

const FINANCIAL_GOALS_KEY = 'iportfolio-financial-goals';

export const FinancialGoalsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [goals, setGoals] = useState<FinancialGoal[]>(() => {
    try {
      const stored = window.localStorage.getItem(FINANCIAL_GOALS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load financial goals:', error);
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(FINANCIAL_GOALS_KEY, JSON.stringify(goals));
    } catch (error) {
      console.error('Failed to save goals:', error);
    }
  }, [goals]);

  const addGoal = (goalData: Omit<FinancialGoal, 'id' | 'currentAmount'>) => {
    const newGoal: FinancialGoal = {
      ...goalData,
      id: new Date().toISOString(),
      currentAmount: 0, // Start with 0
    };
    setGoals(prev => [...prev, newGoal]);
  };

  const updateGoal = (updatedGoal: FinancialGoal) => {
    setGoals(prev => prev.map(g => (g.id === updatedGoal.id ? updatedGoal : g)));
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  return (
    <FinancialGoalsContext.Provider value={{ goals, addGoal, updateGoal, deleteGoal }}>
      {children}
    </FinancialGoalsContext.Provider>
  );
};

export const useFinancialGoals = () => {
  const context = useContext(FinancialGoalsContext);
  if (context === undefined) {
    throw new Error('useFinancialGoals must be used within a FinancialGoalsProvider');
  }
  return context;
};

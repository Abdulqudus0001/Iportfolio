import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import BudgetModal from './BudgetModal';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Budget } from '../../types';

const BudgetTracker: React.FC = () => {
  const [budget, setBudget] = useLocalStorage<Budget>('iportfolio-budget', { income: 0, expenses: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const surplus = budget.income - budget.expenses;

  return (
    <>
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentBudget={budget}
        onSave={setBudget}
      />
      <Card title="My Budget">
        {budget.income > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Income</p>
                <p className="font-bold text-green-600">${budget.income.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Expenses</p>
                <p className="font-bold text-red-600">${budget.expenses.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Surplus</p>
                <p className={`font-bold ${surplus >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ${surplus.toLocaleString()}
                </p>
              </div>
            </div>
            <Button variant="secondary" className="w-full text-sm" onClick={() => setIsModalOpen(true)}>
              Edit Budget
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Track your monthly budget to find your investable surplus.
            </p>
            <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
              Set Up Budget
            </Button>
          </div>
        )}
      </Card>
    </>
  );
};

export default BudgetTracker;

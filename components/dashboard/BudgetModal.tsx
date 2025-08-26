import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Budget } from '../../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBudget: Budget;
  onSave: (budget: Budget) => void;
}

const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, currentBudget, onSave }) => {
  const [income, setIncome] = useState(currentBudget.income || '');
  const [expenses, setExpenses] = useState(currentBudget.expenses || '');
  
  useEffect(() => {
    setIncome(currentBudget.income || '');
    setExpenses(currentBudget.expenses || '');
  }, [currentBudget]);

  const handleSave = () => {
    onSave({
      income: Number(income) || 0,
      expenses: Number(expenses) || 0,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Your Monthly Budget">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter your estimated monthly income and expenses to calculate your investable surplus.
        </p>
        <div>
          <label className="block text-sm font-medium">Total Monthly Income ($)</label>
          <input
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="e.g., 5000"
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Total Monthly Expenses ($)</label>
          <input
            type="number"
            value={expenses}
            onChange={(e) => setExpenses(e.target.value)}
            placeholder="e.g., 3500"
            className="w-full mt-1 p-2 border rounded"
          />
        </div>
        <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Budget</Button>
        </div>
      </div>
    </Modal>
  );
};

export default BudgetModal;

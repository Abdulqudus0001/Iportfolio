import React, { useState } from 'react';
import { useFinancialGoals } from '../../context/FinancialGoalsContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { FinancialGoal } from '../../types';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ isOpen, onClose }) => {
  const { addGoal, goals, deleteGoal } = useFinancialGoals();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !targetDate) return;

    addGoal({
      name,
      targetAmount: parseFloat(targetAmount),
      targetDate
    });

    // Reset form
    setName('');
    setTargetAmount('');
    setTargetDate('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Financial Goals">
        <div className="space-y-4">
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg dark:border-gray-600 space-y-3">
                <h3 className="font-semibold text-lg">Add New Goal</h3>
                <div>
                    <label className="block text-sm font-medium">Goal Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., House Down Payment" className="w-full mt-1 p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Target Amount ($)</label>
                    <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="e.g., 50000" className="w-full mt-1 p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Target Date</label>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full mt-1 p-2 border rounded" required />
                </div>
                <Button type="submit" className="w-full">Add Goal</Button>
            </form>

            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Existing Goals</h3>
                {goals.length > 0 ? (
                    goals.map(goal => (
                        <div key={goal.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                            <span>{goal.name} - ${goal.targetAmount.toLocaleString()}</span>
                            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => deleteGoal(goal.id)}>Delete</Button>
                        </div>
                    ))
                ) : <p className="text-sm text-gray-500">No goals yet.</p>}
            </div>
        </div>
    </Modal>
  );
};

export default AddGoalModal;

import React from 'react';
import { Asset, BlackLittermanView } from '../../types';
import Button from '../ui/Button';

interface BlackLittermanViewsUIProps {
  views: BlackLittermanView[];
  setViews: React.Dispatch<React.SetStateAction<BlackLittermanView[]>>;
  availableAssets: Asset[];
}

const BlackLittermanViewsUI: React.FC<BlackLittermanViewsUIProps> = ({ views, setViews, availableAssets }) => {

  const handleAddView = () => {
    setViews([...views, { id: Date.now().toString(), asset_ticker_1: '', direction: 'outperform', asset_ticker_2: '', expected_return_diff: 0.02, confidence: 0.5 }]);
  };

  const handleRemoveView = (id: string) => {
    setViews(views.filter(v => v.id !== id));
  };

  const handleViewChange = (id: string, field: keyof Omit<BlackLittermanView, 'id'>, value: string | number) => {
    setViews(views.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4 mt-4">
      <h4 className="font-semibold text-brand-secondary">Black-Litterman Views</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">Incorporate your market views into the optimization. Define which assets you believe will outperform or underperform others.</p>
      
      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        {views.map(view => (
          <div key={view.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-white dark:bg-dark-card rounded shadow-sm">
            <select
                value={view.asset_ticker_1}
                onChange={e => handleViewChange(view.id, 'asset_ticker_1', e.target.value)}
                className="col-span-3 p-1 text-xs border rounded"
            >
                <option value="">Asset 1</option>
                {availableAssets.map(a => <option key={a.ticker} value={a.ticker}>{a.ticker}</option>)}
            </select>
            
            <select
                value={view.direction}
                onChange={e => handleViewChange(view.id, 'direction', e.target.value)}
                className="col-span-2 p-1 text-xs border rounded"
            >
                <option value="outperform">will outperform</option>
                <option value="underperform">will underperform</option>
            </select>

            <select
                value={view.asset_ticker_2}
                onChange={e => handleViewChange(view.id, 'asset_ticker_2', e.target.value)}
                className="col-span-3 p-1 text-xs border rounded"
            >
                <option value="">Asset 2</option>
                {availableAssets.map(a => <option key={a.ticker} value={a.ticker}>{a.ticker}</option>)}
            </select>

            <div className="col-span-3 flex items-center gap-1">
                 <input
                    type="number"
                    step="0.5"
                    value={view.expected_return_diff * 100}
                    onChange={e => handleViewChange(view.id, 'expected_return_diff', parseFloat(e.target.value)/100)}
                    className="w-12 p-1 text-xs border rounded"
                />
                 <span className="text-xs">%</span>
            </div>

            <button onClick={() => handleRemoveView(view.id)} className="col-span-1 text-red-500 hover:text-red-700 text-xs">X</button>
          </div>
        ))}
      </div>

      <Button onClick={handleAddView} variant="secondary" className="w-full text-sm">
        Add New View
      </Button>
    </div>
  );
};

export default BlackLittermanViewsUI;

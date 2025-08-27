import React, { useState, useMemo, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { useUserTier } from '../context/UserTierContext';
import { UserTier, Alert, RebalancingAlert, Asset } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { useAlerts } from '../context/AlertsContext';
import { marketDataService } from '../services/marketDataService';

const AlertsView: React.FC = () => {
    const { tier } = useUserTier();
    const { optimizationResult } = usePortfolio();
    const { 
        priceAlerts, 
        rebalancingAlerts, 
        addPriceAlert, 
        deletePriceAlert, 
        addRebalancingAlert, 
        deleteRebalancingAlert 
    } = useAlerts();

    const [activeTab, setActiveTab] = useState<'rebalancing' | 'price'>('rebalancing');
    
    // Price Alerts State
    const [masterAssetList, setMasterAssetList] = useState<Asset[]>([]);
    const [assetSearch, setAssetSearch] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [newPriceAlert, setNewPriceAlert] = useState<{ticker: string, condition: Alert['condition'], value: number | ''}>({
        ticker: '', condition: 'price_below', value: ''
    });

    // Rebalancing Alerts State
    const [newRebalancingAlert, setNewRebalancingAlert] = useState({ type: 'sector', target: '', maxWeight: '' });

    const isProOrHigher = tier === UserTier.Professional || tier === UserTier.Advanced;
    const isAdvanced = tier === UserTier.Advanced;
    
    useEffect(() => {
        marketDataService.getAvailableAssets().then(setMasterAssetList);
    }, []);

    // --- Price Alerts Logic ---
    const assetSearchResults = useMemo(() => {
        if (!assetSearch) return [];
        return masterAssetList.filter(a => 
            a.ticker.toLowerCase().includes(assetSearch.toLowerCase()) || 
            a.name.toLowerCase().includes(assetSearch.toLowerCase())
        ).slice(0, 7);
    }, [assetSearch, masterAssetList]);

    const handleAddPriceAlert = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPriceAlert.ticker || newPriceAlert.value === '') return;
        const alertToAdd: Alert = {
            id: new Date().toISOString(), ...newPriceAlert, value: Number(newPriceAlert.value), createdAt: new Date().toISOString()
        };
        addPriceAlert(alertToAdd);
        setNewPriceAlert({ ticker: '', condition: 'price_below', value: '' });
        setAssetSearch('');
    };
    
    // --- Rebalancing Alerts Logic ---
    const rebalancingTargets = useMemo(() => {
        if (!optimizationResult) return { sectors: [], asset_classes: [] };
        const sectors = [...new Set(optimizationResult.weights.map(a => a.sector))];
        const asset_classes = [...new Set(optimizationResult.weights.map(a => a.asset_class))];
        return { sectors, asset_classes };
    }, [optimizationResult]);

    const handleAddRebalancingAlert = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRebalancingAlert.target || !newRebalancingAlert.maxWeight) return;
        const alertToAdd: RebalancingAlert = {
            id: new Date().toISOString(),
            type: newRebalancingAlert.type as 'sector' | 'asset_class',
            target: newRebalancingAlert.target,
            maxWeight: parseFloat(newRebalancingAlert.maxWeight),
            createdAt: new Date().toISOString(),
        };
        addRebalancingAlert(alertToAdd);
        setNewRebalancingAlert({ type: 'sector', target: '', maxWeight: '' });
    };

    const renderPriceAlerts = () => (
        <div className="space-y-4">
             <form onSubmit={handleAddPriceAlert} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="relative">
                    <label className="block text-sm font-medium">Asset</label>
                     <input type="text" value={assetSearch}
                        onChange={e => { setAssetSearch(e.target.value); if (newPriceAlert.ticker) setNewPriceAlert(p => ({ ...p, ticker: '' })); }}
                        onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                        placeholder="Search ticker or name..." className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600" required={!newPriceAlert.ticker}/>
                     {isSearchFocused && assetSearchResults.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white dark:bg-dark-card border dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                            {assetSearchResults.map(asset => (
                                <li key={asset.ticker} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                                    onMouseDown={() => { setNewPriceAlert(p => ({ ...p, ticker: asset.ticker })); setAssetSearch(`${asset.ticker} - ${asset.name}`); setIsSearchFocused(false); }}>
                                    <span className="font-bold">{asset.ticker}</span> - {asset.name}
                                </li>
                            ))}
                        </ul>
                     )}
                </div>
                <div>
                    <label className="block text-sm font-medium">Condition</label>
                     <select value={newPriceAlert.condition} onChange={e => setNewPriceAlert(prev => ({ ...prev, condition: e.target.value as Alert['condition'] }))}
                        className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600">
                        <option value="price_below">Price Below</option>
                        <option value="price_above">Price Above</option>
                        <option value="vol_above">Volatility Above</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Value</label>
                    <input type="number" value={newPriceAlert.value} onChange={e => setNewPriceAlert(prev => ({ ...prev, value: parseFloat(e.target.value) || ''}))}
                        className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600" placeholder={newPriceAlert.condition === 'vol_above' ? 'e.g., 30 (%)' : 'e.g., 150.50'} required />
                </div>
                <Button type="submit" disabled={!newPriceAlert.ticker}>Add Alert</Button>
            </form>
            {priceAlerts.length > 0 ? (
                <ul className="space-y-3">
                    {priceAlerts.map(alert => (
                        <li key={alert.id} className="flex justify-between items-center p-3 bg-light-card dark:bg-dark-card shadow-sm rounded-md border dark:border-gray-700">
                            <div>
                                <span className="font-bold text-brand-primary">{alert.ticker}</span>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">{`Price is ${alert.condition === 'price_above' ? 'above' : 'below'} $${alert.value}`}</p>
                            </div>
                            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => deletePriceAlert(alert.id)}>Delete</Button>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">You have no active price alerts.</p>}
        </div>
    );
    
    const renderRebalancingAlerts = () => (
         <div className="space-y-4">
             <form onSubmit={handleAddRebalancingAlert} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                    <label className="block text-sm font-medium">Type</label>
                     <select value={newRebalancingAlert.type} onChange={e => setNewRebalancingAlert({ ...newRebalancingAlert, type: e.target.value, target: '' })} className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600">
                        <option value="sector">Sector</option>
                        <option value="asset_class">Asset Class</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Target</label>
                    <select value={newRebalancingAlert.target} onChange={e => setNewRebalancingAlert({ ...newRebalancingAlert, target: e.target.value })} className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600" required>
                        <option value="">Select a target...</option>
                        {(newRebalancingAlert.type === 'sector' ? rebalancingTargets.sectors : rebalancingTargets.asset_classes).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Max Weight (%)</label>
                    <input type="number" value={newRebalancingAlert.maxWeight} onChange={e => setNewRebalancingAlert({ ...newRebalancingAlert, maxWeight: e.target.value })}
                        className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600" placeholder="e.g., 25" required />
                </div>
                <Button type="submit" disabled={!optimizationResult}>Add Alert</Button>
             </form>
              {!optimizationResult && <p className="text-sm text-center text-yellow-700">Load a portfolio to set rebalancing alerts.</p>}
             {rebalancingAlerts.length > 0 ? (
                <ul className="space-y-3">
                    {rebalancingAlerts.map(alert => (
                        <li key={alert.id} className="flex justify-between items-center p-3 bg-light-card dark:bg-dark-card shadow-sm rounded-md border dark:border-gray-700">
                            <div>
                                <span className="font-bold text-brand-primary capitalize">{alert.type}: {alert.target}</span>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary">Alert if weight exceeds {alert.maxWeight}%</p>
                            </div>
                            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => deleteRebalancingAlert(alert.id)}>Delete</Button>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">You have no active rebalancing alerts.</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <Card title="Manage Alerts">
                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                    <nav className="-mb-px flex space-x-6">
                        <button onClick={() => setActiveTab('rebalancing')} disabled={!isProOrHigher} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'rebalancing' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'} disabled:opacity-50`}>
                            Rebalancing Alerts {tier === 'Basic' && '(Pro+)'}
                        </button>
                        <button onClick={() => setActiveTab('price')} disabled={!isAdvanced} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'price' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'} disabled:opacity-50`}>
                            Price Alerts {tier !== 'Advanced' && '(Advanced)'}
                        </button>
                    </nav>
                </div>
                {activeTab === 'rebalancing' && (isProOrHigher ? renderRebalancingAlerts() : <FeatureLock tier="Professional" />)}
                {activeTab === 'price' && (isAdvanced ? renderPriceAlerts() : <FeatureLock tier="Advanced" />)}
            </Card>
        </div>
    );
};

const FeatureLock: React.FC<{tier: 'Professional' | 'Advanced'}> = ({ tier }) => (
    <div className="text-center p-8 border-dashed border-2 rounded-lg dark:border-gray-600">
        <h3 className="text-lg font-semibold text-brand-secondary">Feature Locked</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2 mb-4">
            This feature is available on the {tier} tier.
        </p>
    </div>
);

export default AlertsView;
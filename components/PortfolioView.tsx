import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUserTier } from '../context/UserTierContext';
import { Asset, UserTier, OptimizationResult, MCMCResult, PortfolioTemplate, ConstraintOptions, GoalSettings, OptimizationModel, BlackLittermanView, Transaction, View, SavedPortfolio, Currency, CURRENCIES, DataSource } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import AnalysisLoader from './ui/AnalysisLoader';
import EfficientFrontierChart from './EfficientFrontierChart';
import AdSenseBanner from './AdSenseBanner';
import { usePortfolio } from '../context/PortfolioContext';
import { useSavedPortfolios } from '../context/SavedPortfoliosContext';
import Modal from './ui/Modal';
import Tooltip from './ui/Tooltip';
import BacktestingView from './BacktestingView';
import InfoIcon from './ui/InfoIcon';
import { portfolioService } from '../services/portfolioService';
import { marketDataService } from '../services/marketDataService';
import PortfolioHealthCheck from './analytics/PortfolioHealthCheck';
import GoalSettingWizard from './GoalSettingWizard';
import BlackLittermanViewsUI from './portfolio/BlackLittermanViewsUI';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { getCurrencySymbol } from '../utils';

interface PortfolioViewProps {
    setCurrentView: (view: View) => void;
}

const DisclaimerModal: React.FC<{ onAccept: () => void, onClose: () => void }> = ({ onAccept, onClose }) => (
    <Modal isOpen={true} onClose={onClose} title="Important Disclaimer">
        <div className="space-y-4">
            <p className="text-base font-semibold text-red-600">This Is Not Financial Advice</p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                iPortfolio is an educational tool for informational purposes only. All outputs, including portfolio allocations and performance metrics, are generated based on historical data and mathematical models.
            </p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span className="font-bold">Past performance is not indicative of future results.</span> The models do not account for all possible market risks, economic changes, or your personal financial situation. Investing involves risk, including the possible loss of principal.
            </p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Consult with a qualified financial professional before making any investment decisions.
            </p>
            <div className="flex justify-end pt-2">
                <Button onClick={onAccept}>I Understand and Accept</Button>
            </div>
        </div>
    </Modal>
);

const PortfolioView: React.FC<PortfolioViewProps> = ({ setCurrentView }) => {
    const { tier } = useUserTier();
    const { user } = useAuth();
    const { 
        currentPortfolio,
        selectedAssets, 
        setSelectedAssets, 
        optimizationResult, 
        setOptimizationResult,
        mcmcResult,
        setMcmcResult,
        transactions,
        setTransactions,
        currency,
        setCurrency,
    } = usePortfolio();
    const { savedPortfolios, savePortfolio } = useSavedPortfolios();

    const [masterAssetList, setMasterAssetList] = useState<Asset[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [template, setTemplate] = useState<PortfolioTemplate>(PortfolioTemplate.Custom);
    const [optimizationModel, setOptimizationModel] = useState<OptimizationModel>(OptimizationModel.MaximizeSharpe);
    const [blackLittermanViews, setBlackLittermanViews] = useState<BlackLittermanView[]>([]);
    const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [portfolioName, setPortfolioName] = useState('');
    const [portfolioNotes, setPortfolioNotes] = useState('');
    const [activeTab, setActiveTab] = useState<'results' | 'backtest'>('results');
    const [constraints, setConstraints] = useState<ConstraintOptions>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
    const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
    const [pendingAnalysisAction, setPendingAnalysisAction] = useState<(() => void) | null>(null);


    const isProfessionalOrHigher = tier === UserTier.Professional || tier === UserTier.Advanced;
    const isAdvanced = tier === UserTier.Advanced;
    const basicCanSave = tier === UserTier.Basic && savedPortfolios.length < 1;
    
    useEffect(() => {
        marketDataService.getAvailableAssets().then(setMasterAssetList);
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem('disclaimerAccepted') === 'true') {
            setIsDisclaimerAccepted(true);
        }
    }, []);
    
    const handleAcceptDisclaimer = () => {
        sessionStorage.setItem('disclaimerAccepted', 'true');
        setIsDisclaimerAccepted(true);
        setIsDisclaimerModalOpen(false);
        if (pendingAnalysisAction) {
            pendingAnalysisAction();
            setPendingAnalysisAction(null);
        }
    };

    const requestAnalysis = (analysisFn: () => void) => {
        if (isDisclaimerAccepted) {
            analysisFn();
        } else {
            setPendingAnalysisAction(() => analysisFn);
            setIsDisclaimerModalOpen(true);
        }
    };


    const handleTemplateChange = (newTemplateValue: string) => {
        const enumKey = Object.keys(PortfolioTemplate).find(key => PortfolioTemplate[key as keyof typeof PortfolioTemplate] === newTemplateValue);
        if (enumKey) {
            const newTemplate = PortfolioTemplate[enumKey as keyof typeof PortfolioTemplate];
            setTemplate(newTemplate);
            if (newTemplate === PortfolioTemplate.Custom) {
                const initialWeights: Record<string, number> = {};
                if (selectedAssets.length > 0) {
                    const defaultWeight = 100 / selectedAssets.length;
                    selectedAssets.forEach(asset => {
                        initialWeights[asset.ticker] = defaultWeight;
                    });
                }
                setCustomWeights(initialWeights);
            }
        }
    };

    const handleOptimizationModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const modelValue = e.target.value;
        const enumKey = Object.keys(OptimizationModel).find(key => OptimizationModel[key as keyof typeof OptimizationModel] === modelValue);
        if (enumKey) {
            setOptimizationModel(OptimizationModel[enumKey as keyof typeof OptimizationModel]);
        }
    };

    const handleWizardComplete = (settings: GoalSettings) => {
        // Suggest a template based on wizard output
        if(settings.riskTolerance === 'Aggressive' || settings.timeline > 20) {
            setTemplate(PortfolioTemplate.Aggressive);
        } else if (settings.riskTolerance === 'Conservative' && settings.timeline < 5) {
            setTemplate(PortfolioTemplate.Balanced); // As a proxy for a conservative, stable choice
        } else {
            setTemplate(PortfolioTemplate.Balanced);
        }
        setIsWizardOpen(false);
        // We could also auto-run analysis here if desired
    };

    const handleConstraintChange = (field: keyof ConstraintOptions, value: string) => {
        const numValue = parseFloat(value);
        if (numValue > 0 && numValue <= 100) {
            setConstraints(prev => ({ ...prev, [field]: numValue / 100 }));
        } else if (value === '') {
             setConstraints(prev => {
                const newConstraints = { ...prev };
                delete newConstraints[field];
                return newConstraints;
            });
        }
    };
    
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return; // Guard against empty files
            const lines = text.split('\n');
            const header = (lines[0] || '').toLowerCase().split(',').map(h => h.trim());
            
            const isTransactionFile = header.includes('quantity') && header.includes('price');

            if (isTransactionFile && isProfessionalOrHigher) {
                 const importedTransactions: Transaction[] = [];
                 lines.slice(1).forEach(line => {
                     const [ticker, date, quantity, price, type] = line.split(',').map(s => s.trim());
                     if(ticker && date && quantity && price && type) {
                         const asset = masterAssetList.find(a => a.ticker.toLowerCase() === (ticker || '').toLowerCase());
                         if(asset){
                            importedTransactions.push({ id: `csv-${Date.now()}-${ticker}`, ticker, date, quantity: parseFloat(quantity), price: parseFloat(price), type: type.toUpperCase() as 'BUY' | 'SELL' });
                         }
                     }
                 });
                 setTransactions(importedTransactions);
                 // Here you might derive current holdings from transactions, a complex task. For now, we just store them.
                 alert(`${importedTransactions.length} transactions imported. Note: Custom portfolio weights are not yet derived from transactions in this version.`);

            } else {
                const importedAssets: Asset[] = [];
                const importedWeights: Record<string, number> = {};
                
                lines.slice(1).forEach(line => {
                    const [ticker, weightStr] = line.split(',').map(s => s.trim());
                    if (ticker) {
                        const asset = masterAssetList.find(a => a.ticker.toLowerCase() === (ticker || '').toLowerCase());
                        if (asset) {
                            importedAssets.push(asset);
                            const weight = parseFloat(weightStr);
                            if (!isNaN(weight)) {
                                importedWeights[asset.ticker] = weight;
                            }
                        }
                    }
                });
                setSelectedAssets(importedAssets);
                setCustomWeights(importedWeights);
                setTemplate(PortfolioTemplate.Custom);
            }
        };
        reader.readAsText(file);
    };

    const handleCustomWeightChange = (ticker: string, weight: number) => {
        setCustomWeights(prev => ({ ...prev, [ticker]: weight }));
    };

    const normalizeWeights = () => {
        const total = Object.values(customWeights).reduce((sum, w) => sum + w, 0);
        if (total === 0 || total === 100) return;
        const normalized: Record<string, number> = {};
        for (const ticker in customWeights) {
            normalized[ticker] = (customWeights[ticker] / total) * 100;
        }
        setCustomWeights(normalized);
    };

    const availableAssets = useMemo(() => {
        return masterAssetList.filter(asset =>
            asset.asset_class !== 'BENCHMARK' &&
            !selectedAssets.some(sa => sa.ticker === asset.ticker) &&
            ((asset.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (asset.ticker || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [selectedAssets, searchTerm, masterAssetList]);

    const handleAddAsset = (asset: Asset) => {
        if (!selectedAssets.some(a => a.ticker === asset.ticker)) {
            const newSelectedAssets = [...selectedAssets, asset];
            setSelectedAssets(newSelectedAssets);
            if (template === PortfolioTemplate.Custom) {
                const newWeights = { ...customWeights, [asset.ticker]: 0 };
                // Rebalance other weights if needed, or just add as 0
                setCustomWeights(newWeights);
            }
        }
    };
    
    const handleRemoveAsset = (ticker: string) => {
        setSelectedAssets(prevAssets => prevAssets.filter(asset => asset.ticker !== ticker));
        if (template === PortfolioTemplate.Custom) {
            setCustomWeights(prevWeights => {
                const newWeights = { ...prevWeights };
                delete newWeights[ticker];
                return newWeights;
            });
        }
    };

    const handleCalculateCustomMetrics = () => requestAnalysis(() => {
        const run = async () => {
            setIsLoading(true);
            setOptimizationResult(null);
            setMcmcResult(null);
            setActiveTab('results');
            setError(null);

            const totalWeight = Object.values(customWeights).reduce((sum, w) => sum + (w || 0), 0);
            if (Math.abs(totalWeight - 100) > 1) {
                setError(`Weights must sum to 100%. Current sum: ${totalWeight.toFixed(2)}%. Please normalize weights first.`);
                setIsLoading(false);
                return;
            }

            try {
                const result = await portfolioService.calculatePortfolioMetricsFromCustomWeights(selectedAssets, customWeights, currency);
                setOptimizationResult(result.data);
            } catch (error) {
                console.error("Custom calculation error:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                setError(`Calculation failed: ${errorMessage}. Please check your inputs or try again later.`);
            } finally {
                setIsLoading(false);
            }
        };
        run();
    });

    const runAnalysis = (runner: 'mcmc' | 'optimize') => requestAnalysis(() => {
        const run = async () => {
            setIsLoading(true);
            setOptimizationResult(null);
            setMcmcResult(null);
            setActiveTab('results');
            setError(null);

            try {
                let result;
                if (optimizationModel === OptimizationModel.BlackLitterman && isAdvanced) {
                    if (selectedAssets.length < 2 || blackLittermanViews.length === 0) {
                        const blError = "Please select at least two assets and add at least one view for Black-Litterman optimization.";
                        setError(blError);
                        throw new Error("Invalid inputs for Black-Litterman");
                    }
                    result = await portfolioService.runBlackLittermanOptimization(selectedAssets, blackLittermanViews, currency);
                } else {
                    if (template === PortfolioTemplate.Custom) {
                        setIsLoading(false);
                        return;
                    }
                    
                    result = await portfolioService.generateAndOptimizePortfolio(
                        template,
                        optimizationModel,
                        runner,
                        currency,
                        constraints
                    );
                }
                
                setSelectedAssets(result.bestSharpe.weights);
                setOptimizationResult(result.bestSharpe);
                if (runner === 'mcmc' || optimizationModel === OptimizationModel.BlackLitterman) {
                    setMcmcResult(result);
                }
            } catch (error) {
                console.error("Analysis error:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage !== "Invalid inputs for Black-Litterman") {
                    setError(`Analysis failed: ${errorMessage}. This can happen when our connection to live market data is busy. Please try again in a few moments.`);
                }
            } finally {
                setIsLoading(false);
            }
        };
        run();
    });
    
    const handleSavePortfolio = async () => {
        if (!portfolioName.trim() || !optimizationResult) return;
        if (tier === UserTier.Basic && savedPortfolios.length >= 1) {
            alert("Basic tier users can only save one portfolio. Upgrade to save more.");
            return;
        }
        await savePortfolio(portfolioName, selectedAssets, optimizationResult, mcmcResult, portfolioNotes, transactions, currency);
        setIsSaveModalOpen(false);
        setPortfolioName('');
        setPortfolioNotes('');
    }

    const handleOpenSaveModal = () => {
        if (!user) {
            setIsAuthModalOpen(true);
        } else {
            if (tier === UserTier.Basic && savedPortfolios.length >= 1) {
                alert("Basic tier users can only save one portfolio. Upgrade to save more.");
                return;
            }
            setIsSaveModalOpen(true);
        }
    };

    const handleSharePortfolio = async () => {
        if (!currentPortfolio) {
            alert("Please save the portfolio before sharing.");
            return;
        }
        try {
            const id = await portfolioService.sharePortfolio(currentPortfolio as SavedPortfolio);
            const link = `${window.location.origin}${window.location.pathname}?share=${id}`;
            setShareLink(link);
            setIsShareModalOpen(true);
        } catch (error) {
            alert("Could not create a shareable link. Please try again.");
        }
    }

    const handleDownloadCSV = () => {
        if (!optimizationResult) return;
        const headers = ["Ticker", "Name", "Sector", "Country", "Weight (%)"];
        const rows = optimizationResult.weights.map(a => 
            [a.ticker, a.name, a.sector, a.country, (a.weight * 100).toFixed(4)].join(',')
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "iportfolio_optimization.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const renderCustomPortfolioBuilder = () => (
        <div className="space-y-4">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                     <h4 className="font-semibold mb-2">Available Assets</h4>
                     <input
                         type="text"
                         placeholder="Search assets..."
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         className="w-full p-2 border border-gray-300 rounded-md mb-2 dark:bg-dark-bg dark:border-gray-600"
                     />
                     <div className="h-48 overflow-y-auto border rounded-md p-2 dark:border-gray-600">
                         {availableAssets.map(asset => (
                             <div key={asset.ticker} className="flex items-center justify-between p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                 <span className="text-sm truncate pr-1">{asset.ticker} - {asset.name}</span>
                                 <Button onClick={() => handleAddAsset(asset)} className="px-2 py-1 text-xs">Add</Button>
                             </div>
                         ))}
                     </div>
                 </div>
                 <div>
                     <div className="flex justify-between items-center mb-2">
                         <h4 className="font-semibold">Selected Assets ({selectedAssets.length})</h4>
                         <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
                         <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                     </div>
                      <div className="h-48 overflow-y-auto border rounded-md p-2 dark:border-gray-600">
                         {selectedAssets.length > 0 ? selectedAssets.map(asset => (
                             <div key={asset.ticker} className="flex items-center justify-between p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                 <div className="flex-grow text-sm truncate pr-1">
                                     <span>{asset.ticker}</span>
                                     <input
                                         type="number"
                                         step="0.1"
                                         value={customWeights[asset.ticker] !== undefined ? customWeights[asset.ticker] : ''}
                                         onChange={(e) => handleCustomWeightChange(asset.ticker, parseFloat(e.target.value) || 0)}
                                         className="w-20 ml-2 p-1 text-xs text-right border rounded dark:bg-dark-bg dark:border-gray-500"
                                         placeholder="Weight %"
                                     />
                                 </div>
                                 <Button onClick={() => handleRemoveAsset(asset.ticker)} variant="danger" className="px-1.5 py-0.5 text-xs">X</Button>
                             </div>
                         )) : <p className="text-sm text-center text-gray-500 py-16">Add assets to get started.</p>}
                     </div>
                 </div>
             </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={normalizeWeights}>Normalize Weights</Button>
                <Button onClick={handleCalculateCustomMetrics} disabled={selectedAssets.length < 1}>Calculate Metrics</Button>
            </div>
        </div>
    );

    return (
        <>
            {isDisclaimerModalOpen && <DisclaimerModal onAccept={handleAcceptDisclaimer} onClose={() => setIsDisclaimerModalOpen(false)} />}
            <div className="grid grid-cols-1 gap-8">
                <div className="space-y-6">
                    <Card title="Portfolio Builder">
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium">Portfolio Mode</label>
                                 <select value={template} onChange={(e) => handleTemplateChange(e.target.value)} className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600">
                                    {Object.values(PortfolioTemplate).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                             </div>
                             {tier === UserTier.Basic && template !== PortfolioTemplate.Custom && template !== PortfolioTemplate.Balanced &&
                                <div className="p-2 bg-yellow-100 text-yellow-800 text-sm rounded-md">
                                    This template is a Professional feature. Your analysis will run on the Balanced template.
                                </div>
                             }
                             <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">Goal Setting</h3>
                                <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => setIsWizardOpen(true)}>Start Wizard</Button>
                             </div>
                             
                             {template === PortfolioTemplate.Custom ? renderCustomPortfolioBuilder() : (
                                <>
                                 <div>
                                    <label className="block text-sm font-medium">Optimization Model</label>
                                     <select value={optimizationModel} onChange={handleOptimizationModelChange} className="w-full mt-1 p-2 border rounded-md dark:bg-dark-bg dark:border-gray-600">
                                        {Object.values(OptimizationModel).map(m => (
                                            <option key={m} value={m} disabled={m === OptimizationModel.BlackLitterman && !isAdvanced}>
                                                {m}{m === OptimizationModel.BlackLitterman && !isAdvanced && ' (Advanced)'}
                                            </option>
                                        ))}
                                    </select>
                                 </div>
                                 {optimizationModel === OptimizationModel.BlackLitterman && isAdvanced && <BlackLittermanViewsUI views={blackLittermanViews} setViews={setBlackLittermanViews} availableAssets={selectedAssets} />}
                                 {isProfessionalOrHigher && (
                                    <div className="space-y-2 pt-2 border-t dark:border-gray-600">
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-300">Constraints (Optional)</h4>
                                         <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs">Max Asset Weight (%)</label>
                                                <input type="number" onChange={(e) => handleConstraintChange('maxAssetWeight', e.target.value)} className="w-full p-1 border rounded text-sm dark:bg-dark-bg dark:border-gray-500" placeholder="e.g., 20" />
                                            </div>
                                             <div>
                                                <label className="text-xs">Max Sector Weight (%)</label>
                                                <input type="number" onChange={(e) => handleConstraintChange('maxSectorWeight', e.target.value)} className="w-full p-1 border rounded text-sm dark:bg-dark-bg dark:border-gray-500" placeholder="e.g., 35" />
                                            </div>
                                         </div>
                                    </div>
                                 )}
                                </>
                             )}
                        </div>
                    </Card>

                    {template !== PortfolioTemplate.Custom && (
                        <Card title="Actions">
                            <div className="space-y-3">
                                 <Button onClick={() => runAnalysis('optimize')} disabled={isLoading} className="w-full">
                                    Quick Optimize
                                </Button>
                                 <Button onClick={() => runAnalysis('mcmc')} disabled={isLoading || tier === UserTier.Basic} className="w-full" variant="secondary">
                                    Comprehensive Analysis {tier === UserTier.Basic && '(Pro+)'}
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
                <div className="space-y-6">
                    {isLoading && <AnalysisLoader />}
                    {error && <Card><p className="text-red-500 text-center py-4">{error}</p></Card>}
                    {optimizationResult ? (
                        <Card title="Analysis Output">
                             <div className="flex justify-end gap-2 mb-4">
                                <Button variant="secondary" onClick={handleDownloadCSV} className="text-xs">Download CSV</Button>
                                <Button variant="secondary" onClick={handleSharePortfolio} className="text-xs" disabled={!currentPortfolio}>Share</Button>
                                <Button onClick={handleOpenSaveModal} className="text-xs" disabled={tier === UserTier.Basic && !basicCanSave}>
                                    {tier === UserTier.Basic && !basicCanSave ? 'Limit Reached' : 'Save'}
                                </Button>
                            </div>
                            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                                <nav className="-mb-px flex space-x-6">
                                    <button onClick={() => setActiveTab('results')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'results' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                        Results
                                    </button>
                                     <button onClick={() => setActiveTab('backtest')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'backtest' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                        Backtest {tier === UserTier.Basic && '(Pro+)'}
                                    </button>
                                </nav>
                            </div>

                            {activeTab === 'results' ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <Metric label="Expected Return" value={`${(optimizationResult.returns * 100).toFixed(2)}%`} />
                                        <Metric label="Volatility (Risk)" value={`${(optimizationResult.volatility * 100).toFixed(2)}%`} />
                                        <Metric label="Sharpe Ratio" value={optimizationResult.sharpeRatio.toFixed(3)} />
                                        <Metric label="Currency" value={optimizationResult.currency || 'USD'} />
                                    </div>

                                    <PortfolioHealthCheck portfolio={optimizationResult} />
                                    
                                    <h4 className="text-lg font-semibold text-brand-primary pt-4 border-t dark:border-gray-700">Optimal Asset Allocation</h4>
                                    <div className="overflow-x-auto">
                                         <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Ticker</th>
                                                    <th className="px-4 py-2 text-left">Name</th>
                                                    <th className="px-4 py-2 text-right">Weight</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {optimizationResult.weights.sort((a,b) => b.weight - a.weight).map(asset => (
                                                    <tr key={asset.ticker}>
                                                        <td className="px-4 py-2 font-medium">{asset.ticker}</td>
                                                        <td className="px-4 py-2">{asset.name}</td>
                                                        <td className="px-4 py-2 text-right font-semibold">{(asset.weight * 100).toFixed(2)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {mcmcResult && mcmcResult.simulations.length > 0 && (
                                        <>
                                            <h4 className="text-lg font-semibold text-brand-primary pt-4 border-t dark:border-gray-700">Efficient Frontier</h4>
                                            <EfficientFrontierChart simulations={mcmcResult.simulations} optimalPoint={optimizationResult} />
                                        </>
                                    )}

                                </div>
                            ) : (
                                isProfessionalOrHigher ? 
                                <BacktestingView portfolio={optimizationResult} /> :
                                <div className="text-center p-8">
                                    <h3 className="text-lg font-semibold text-brand-secondary">Feature Locked</h3>
                                    <p className="text-gray-600 dark:text-gray-400 mt-2">Backtesting is available on the Professional tier and higher.</p>
                                </div>
                            )}

                        </Card>
                    ) : (
                        <Card>
                            <div className="text-center py-24">
                                <h2 className="text-2xl font-semibold text-brand-primary mb-4">Ready to Optimize?</h2>
                                <p className="text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
                                    Your analysis results will appear here after you run an optimization from the builder on the left.
                                </p>
                            </div>
                        </Card>
                    )}
                    <AdSenseBanner 
                        data-ad-client="ca-pub-5175221516557079"
                        data-ad-slot="4509195764" 
                    />
                </div>
            </div>

            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Portfolio">
                <div className="space-y-4">
                    <input type="text" value={portfolioName} onChange={e => setPortfolioName(e.target.value)} placeholder="Enter portfolio name..." className="w-full p-2 border rounded" required />
                    <textarea value={portfolioNotes} onChange={e => setPortfolioNotes(e.target.value)} placeholder="Add optional notes..." className="w-full p-2 border rounded" rows={3}></textarea>
                    <Button onClick={handleSavePortfolio} className="w-full">Save</Button>
                </div>
            </Modal>

            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Portfolio">
                <p className="text-sm text-gray-500 mb-2">Anyone with this link can view a snapshot of your portfolio.</p>
                <input type="text" readOnly value={shareLink} className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                 <Button onClick={() => navigator.clipboard.writeText(shareLink)} className="w-full mt-2">Copy Link</Button>
            </Modal>
            
            <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title="Authentication Required">
                <div className="text-center">
                    <p className="mb-4">Please sign in or create an account to save and share your portfolios.</p>
                    <Button onClick={() => { setIsAuthModalOpen(false); setCurrentView('auth'); }}>Go to Sign In</Button>
                </div>
            </Modal>

            {isWizardOpen && <GoalSettingWizard onClose={() => setIsWizardOpen(false)} onComplete={handleWizardComplete} />}
        </>
    );
};

const Metric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-xs text-gray-500 dark:text-gray-400">{label}</h4>
        <p className="text-lg font-bold text-brand-secondary">{value}</p>
    </div>
);

export default PortfolioView;
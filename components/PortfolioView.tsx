import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUserTier } from '../context/UserTierContext';
import { Asset, UserTier, OptimizationResult, MCMCResult, PortfolioTemplate, ConstraintOptions, GoalSettings, OptimizationModel, BlackLittermanView, Transaction, View, SavedPortfolio, Currency, CURRENCIES } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import AnalysisLoader from './ui/AnalysisLoader';
import EfficientFrontierChart from './EfficientFrontierChart';
import AdBanner from './AdBanner';
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
import WarningBanner from './ui/WarningBanner';

type DataSource = 'live' | 'cache' | 'static';

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
    const [analysisSource, setAnalysisSource] = useState<DataSource>('live');
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

    useEffect(() => {
        if (template === PortfolioTemplate.Custom) {
            setCustomWeights(prevWeights => {
                const newWeights: Record<string, number> = {};
                const selectedAssetTickers = new Set(selectedAssets.map(a => a.ticker));
                for (const ticker in prevWeights) {
                    if (selectedAssetTickers.has(ticker)) {
                        newWeights[ticker] = prevWeights[ticker];
                    }
                }
                selectedAssets.forEach(asset => {
                    if (!(asset.ticker in newWeights)) {
                        newWeights[asset.ticker] = 0;
                    }
                });
                return newWeights;
            });
        }
    }, [selectedAssets, template]);
    
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
        setOptimizationModel(e.target.value as OptimizationModel);
    };

    const handleWizardComplete = (settings: GoalSettings) => {
        // Suggest a template based on wizard output
        if(settings.riskTolerance === 'Aggressive' || settings.timeline > 20) {
            setTemplate(PortfolioTemplate.Aggressive);
        } else if (settings.riskTolerance === 'Conservative' && settings.timeline < 5) {
            setTemplate(PortfolioTemplate.ESG); // As a proxy for a conservative, stable choice
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
            setSelectedAssets([...selectedAssets, asset]);
            if (template === PortfolioTemplate.Custom) {
                setCustomWeights(prev => ({
                    ...prev,
                    [asset.ticker]: 0 
                }));
            }
        }
    };

    const handleRemoveAsset = (ticker: string) => {
        setSelectedAssets(selectedAssets.filter(asset => asset.ticker !== ticker));
        const newWeights = {...customWeights};
        delete newWeights[ticker];
        setCustomWeights(newWeights);
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
                setOptimizationResult(result);
                setAnalysisSource(result.source);
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
                setAnalysisSource(result.source);
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
                                         value={customWeights[asset.ticker]?.toFixed(1) || ''}
                                         onChange={e => handleCustomWeightChange(asset.ticker, parseFloat(e.target.value) || 0)}
                                         className="w-16 p-1 border border-gray-300 rounded-md text-right ml-2 dark:bg-dark-bg dark:border-gray-600"
                                     />%
                                 </div>
                                 <Button onClick={() => handleRemoveAsset(asset.ticker)} variant="danger" className="px-2 py-1 text-xs">X</Button>
                             </div>
                         )) : <p className="text-sm text-gray-500 text-center pt-4">Add assets or import a CSV.</p>}
                     </div>
                 </div>
             </div>
              <div className="flex space-x-2">
                  <Button onClick={normalizeWeights} className="w-full" variant="secondary" disabled={isLoading}>Normalize Weights</Button>
                 <Button onClick={handleCalculateCustomMetrics} className="w-full" disabled={isLoading || selectedAssets.length === 0}>Calculate Metrics</Button>
             </div>
        </div>
     );

    
    return (
        <div className="space-y-6">
             {isWizardOpen && <GoalSettingWizard onClose={() => setIsWizardOpen(false)} onComplete={handleWizardComplete} />}
             {isDisclaimerModalOpen && <DisclaimerModal onAccept={handleAcceptDisclaimer} onClose={() => setIsDisclaimerModalOpen(false)} />}

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" title="Portfolio Builder">
                    {tier === UserTier.Basic && (
                         <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between dark:bg-blue-900/50 dark:border-blue-700">
                            <div>
                               <h4 className="font-semibold text-brand-primary">New to Investing?</h4>
                               <p className="text-sm text-blue-800 dark:text-blue-200">Use our guided wizard to find a strategy that fits your goals.</p>
                            </div>
                            <Button onClick={() => setIsWizardOpen(true)}>Start Wizard</Button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div>
                            <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portfolio Mode</label>
                            <select
                                id="template"
                                value={template}
                                onChange={e => handleTemplateChange(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
                            >
                               {Object.values(PortfolioTemplate).map(t => {
                                    const isBasicLocked = tier === UserTier.Basic && t !== PortfolioTemplate.Balanced && t !== PortfolioTemplate.Custom;
                                    const isProLocked = tier === UserTier.Professional && (t === PortfolioTemplate.Custom && optimizationModel === OptimizationModel.BlackLitterman);
                                    const isDisabled = isBasicLocked || isProLocked;

                                    let label: string;
                                    if (t === PortfolioTemplate.Custom) {
                                        label = "Custom Portfolio (Manual Entry)";
                                    } else {
                                        label = `Strategy Template: ${t}`;
                                    }
                                    if (isBasicLocked) label += ' (Pro+)';
                                    if (isProLocked) label += ' (Advanced)';

                                    return <option key={t} value={t} disabled={isDisabled}>{label}</option>
                                })}
                            </select>
                         </div>
                         <div>
                            <label htmlFor="optimization-model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Optimization Model</label>
                            <select
                                id="optimization-model"
                                value={optimizationModel}
                                onChange={handleOptimizationModelChange}
                                className="w-full p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
                                disabled={template === PortfolioTemplate.Custom && optimizationModel !== OptimizationModel.BlackLitterman}
                            >
                                {Object.values(OptimizationModel).map(m => {
                                    const isAdvancedOnly = m === OptimizationModel.MinimizeVolatility || m === OptimizationModel.RiskParity || m === OptimizationModel.BlackLitterman;
                                    const isDisabled = isAdvancedOnly && !isAdvanced;
                                    let label = m;
                                    if (isDisabled) label += ' (Advanced)';
                                    return <option key={m} value={m}>{label}</option>
                                })}
                            </select>
                         </div>
                         <div>
                            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portfolio Currency</label>
                            <select
                                id="currency"
                                value={currency}
                                onChange={e => setCurrency(e.target.value as Currency)}
                                className="w-full p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
                            >
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                    </div>
                     {template === PortfolioTemplate.Custom || optimizationModel === OptimizationModel.BlackLitterman ? (
                        <>
                            {renderCustomPortfolioBuilder()}
                            {optimizationModel === OptimizationModel.BlackLitterman && isAdvanced &&
                                <BlackLittermanViewsUI views={blackLittermanViews} setViews={setBlackLittermanViews} availableAssets={selectedAssets} />
                            }
                        </>
                     ) : (
                         isAdvanced ? (
                            <Card title="Advanced Constraints" className="bg-gray-50 shadow-inner dark:bg-dark-bg">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Asset Weight (%)</label>
                                        <input 
                                            type="number"
                                            placeholder="e.g., 10"
                                            onChange={e => handleConstraintChange('maxAssetWeight', e.target.value)}
                                            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Sector Weight (%)</label>
                                        <input 
                                            type="number"
                                            placeholder="e.g., 30"
                                            onChange={e => handleConstraintChange('maxSectorWeight', e.target.value)}
                                            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-card dark:border-gray-600"
                                        />
                                    </div>
                                </div>
                            </Card>
                         ) : (
                            <div className="text-center p-8 border-dashed border-2 rounded-lg">
                                <h3 className="text-lg font-semibold text-brand-secondary">Ready to Generate a Portfolio?</h3>
                                <p className="text-gray-600 mt-2 mb-4 dark:text-gray-300">
                                   Based on your selected '{template}' strategy, we will select a basket of assets and find the optimal allocation for you.
                                </p>
                           </div>
                         )
                     )}
                    {tier === UserTier.Basic && template !== PortfolioTemplate.Custom && <p className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded-md mt-4 dark:bg-yellow-900/50 dark:text-yellow-300">Upgrade to Professional to unlock more portfolio strategies like ESG, Aggressive, and Shariah-compliant.</p>}
                </Card>
                
                <Card title="Actions">
                    <div className="space-y-4">
                        <Button onClick={() => runAnalysis('optimize')} disabled={isLoading || (template === PortfolioTemplate.Custom && optimizationModel !== OptimizationModel.BlackLitterman)} className="w-full">
                           Generate & Optimize
                        </Button>
                        <Button onClick={() => runAnalysis('mcmc')} disabled={!isAdvanced || isLoading || (template === PortfolioTemplate.Custom && optimizationModel !== OptimizationModel.BlackLitterman)} className="w-full">
                            Run Comprehensive Analysis
                        </Button>
                        <div className="text-center">
                            {template === PortfolioTemplate.Custom && optimizationModel !== OptimizationModel.BlackLitterman && <p className="text-xs text-gray-500">Use "Calculate Metrics" in the builder above.</p>}
                            {!isAdvanced && template !== PortfolioTemplate.Custom && <p className="text-xs text-gray-500">Upgrade to Advanced for more models, constraints, and full MCMC simulations.</p>}
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-tight mt-2">
                                Note: Portfolio analysis uses live market data and may be subject to API limits on free plans.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
            
            <AdBanner type={tier === UserTier.Basic ? "banner" : "inline"} />
            
            {isLoading && <Card><AnalysisLoader /></Card>}

            {error && (
                <Card>
                    <WarningBanner source="static" message={error} />
                </Card>
            )}
            
            {optimizationResult && (
                <>
                {analysisSource !== 'live' &&
                    <WarningBanner 
                        source={analysisSource}
                        message={analysisSource === 'cache' ? "This analysis was run using recently cached market data as live data was unavailable. Results are recent but may not be real-time." : "The connection to live market data failed, so this analysis was run using a saved data snapshot. The results are for illustrative purposes only."}
                    />
                }
                <Card title="Portfolio Health Check">
                    <PortfolioHealthCheck portfolio={optimizationResult} />
                </Card>
                <Card title="Analysis Output">
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                        <nav className="-mb-px flex space-x-6">
                            <button onClick={() => setActiveTab('results')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'results' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                Results
                            </button>
                             <button onClick={() => setActiveTab('backtest')} disabled={tier === UserTier.Basic} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'backtest' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} disabled:opacity-50`}>
                                Backtest {tier === UserTier.Basic && '(Pro+)'}
                            </button>
                        </nav>
                    </div>
                    
                    {activeTab === 'results' && (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            <div className="md:col-span-2">
                                <h3 className="text-lg font-semibold mb-2">Portfolio Allocation ({optimizationResult.currency})</h3>
                                <ul className="space-y-2 max-h-80 overflow-y-auto">
                                    {optimizationResult.weights.sort((a,b)=>b.weight-a.weight).map(asset => (
                                        <li key={asset.ticker} className="flex justify-between items-center text-sm">
                                            <span className="truncate pr-2">{asset.ticker} - {asset.name}</span>
                                            <span className="font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded-full whitespace-nowrap dark:bg-blue-900 dark:text-blue-200">{(asset.weight * 100).toFixed(2)}%</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                    <h4 className="font-semibold text-lg">Portfolio Metrics</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                                                <span>Historically-Modeled Annual Return</span>
                                                <Tooltip text="The anticipated annualized return on the portfolio, based on the historical average returns of its assets. Past performance is not indicative of future results.">
                                                    <InfoIcon />
                                                </Tooltip>
                                            </div>
                                            <span className="font-semibold">{(optimizationResult.returns * 100).toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                                                <span>Historical Volatility</span>
                                                <Tooltip text="Measures the total risk or price fluctuation of the portfolio based on historical data. Higher values indicate greater risk.">
                                                    <InfoIcon />
                                                </Tooltip>
                                            </div>
                                            <span className="font-semibold">{(optimizationResult.volatility * 100).toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                                                <span>Sharpe Ratio</span>
                                                <Tooltip text="Measures historical risk-adjusted return (return per unit of risk). A higher value is better.">
                                                    <InfoIcon />
                                                </Tooltip>
                                            </div>
                                            <span className="font-bold text-green-600 text-base">{optimizationResult.sharpeRatio.toFixed(3)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <Tooltip text={!user ? "Sign in to save portfolios" : (tier === UserTier.Basic && !basicCanSave ? "Upgrade to save more than one portfolio." : "Save this portfolio for later access.")}>
                                        <div className="w-full">
                                            <Button onClick={handleOpenSaveModal} className="w-full" variant="secondary" disabled={!!user && tier === UserTier.Basic && !basicCanSave}>Save</Button>
                                        </div>
                                    </Tooltip>
                                    <Tooltip text={!currentPortfolio ? "Save your portfolio first to enable sharing" : "Generate a shareable link"}>
                                        <div className="w-full">
                                            <Button onClick={handleSharePortfolio} disabled={!currentPortfolio} className="w-full" variant="secondary">Share</Button>
                                        </div>
                                    </Tooltip>
                                    {tier !== UserTier.Basic && <Button onClick={handleDownloadCSV} className="w-full col-span-2">Download CSV</Button>}
                                </div>
                            </div>
                            {mcmcResult && (
                                <div className="md:col-span-3">
                                    <h3 className="text-lg font-semibold mb-2">Efficient Frontier</h3>
                                    <EfficientFrontierChart simulations={mcmcResult.simulations} optimalPoint={optimizationResult} />
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'backtest' && <BacktestingView portfolio={optimizationResult} />}
                </Card>
                </>
            )}
            
            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Portfolio">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Enter a name for your new portfolio to save it for later access.</p>
                    <div>
                        <label htmlFor="portfolio-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Portfolio Name</label>
                        <input
                            type="text"
                            id="portfolio-name"
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600"
                            placeholder="e.g., My Growth Portfolio"
                        />
                    </div>
                    <div>
                        <label htmlFor="portfolio-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Journal</label>
                        <textarea
                            id="portfolio-notes"
                            value={portfolioNotes}
                            onChange={(e) => setPortfolioNotes(e.target.value)}
                            rows={3}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600"
                            placeholder="e.g., Investment thesis, reasons for this allocation..."
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setIsSaveModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSavePortfolio} disabled={!portfolioName.trim()}>Save</Button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Portfolio">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Share this private link to give a read-only view of your portfolio.
                    </p>
                    <input
                        type="text"
                        readOnly
                        value={shareLink}
                        className="w-full p-2 border rounded-md bg-gray-100 dark:bg-dark-bg"
                        onFocus={(e) => e.target.select()}
                    />
                    <Button onClick={() => navigator.clipboard.writeText(shareLink)} className="w-full">
                        Copy Link
                    </Button>
                </div>
            </Modal>
            <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title="Create Account to Save">
                <div className="text-center space-y-4 p-4">
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        Saving portfolios is a free feature, but you need an account to use it.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        An account lets you access your saved portfolios from any device.
                    </p>
                    <Button 
                        onClick={() => {
                            setIsAuthModalOpen(false);
                            setCurrentView('auth');
                        }} 
                        className="w-full"
                    >
                        Sign Up or Sign In
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default PortfolioView;
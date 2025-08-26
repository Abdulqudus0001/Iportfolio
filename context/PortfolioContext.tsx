import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Asset, OptimizationResult, MCMCResult, SavedPortfolio, Transaction, Currency } from '../types';

interface PortfolioContextType {
  currentPortfolio: SavedPortfolio | null;
  selectedAssets: Asset[];
  setSelectedAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  optimizationResult: OptimizationResult | null;
  setOptimizationResult: React.Dispatch<React.SetStateAction<OptimizationResult | null>>;
  mcmcResult: MCMCResult | null;
  setMcmcResult: React.Dispatch<React.SetStateAction<MCMCResult | null>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currency: Currency;
  setCurrency: React.Dispatch<React.SetStateAction<Currency>>;
  loadPortfolio: (portfolio: SavedPortfolio) => void;
  clearPortfolio: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPortfolio, setCurrentPortfolio] = useState<SavedPortfolio | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [mcmcResult, setMcmcResult] = useState<MCMCResult | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState<Currency>('USD');

  const loadPortfolio = (portfolio: SavedPortfolio) => {
      setCurrentPortfolio(portfolio);
      // The `assets` are now part of the `result` object from the database
      setSelectedAssets(portfolio.result.weights); 
      setOptimizationResult(portfolio.result);
      setMcmcResult(portfolio.mcmc_result || null);
      setTransactions(portfolio.transactions || []);
      setCurrency(portfolio.currency || 'USD');
  };
  
  const clearPortfolio = () => {
      setCurrentPortfolio(null);
      setSelectedAssets([]);
      setOptimizationResult(null);
      setMcmcResult(null);
      setTransactions([]);
      setCurrency('USD');
  }

  return (
    <PortfolioContext.Provider value={{
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
      loadPortfolio,
      clearPortfolio
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
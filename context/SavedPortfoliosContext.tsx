import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { SavedPortfolio, OptimizationResult, Asset, MCMCResult, Transaction, PortfolioTemplate, Currency } from '../types';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { PostgrestError } from '@supabase/supabase-js';

interface SavedPortfoliosContextType {
  savedPortfolios: SavedPortfolio[];
  savePortfolio: (name: string, assets: Asset[], result: OptimizationResult, mcmcResult: MCMCResult | null, notes?: string, transactions?: Transaction[], currency?: Currency) => Promise<void>;
  deletePortfolio: (id: number) => Promise<void>;
  loading: boolean;
}

const SavedPortfoliosContext = createContext<SavedPortfoliosContextType | undefined>(undefined);

export const SavedPortfoliosProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPortfolios = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error }: { data: any[] | null; error: PostgrestError | null } = await supabase
        .from('Portfolio')
        .select('id, name, created_at, result, mcmc_result, notes, transactions, currency')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const formattedData = data
          .map((p: any): SavedPortfolio | null => {
            if (!p || !p.result) {
              return null;
            }
            return {
              id: p.id,
              name: p.name,
              created_at: p.created_at,
              result: p.result,
              mcmc_result: p.mcmc_result ?? null,
              notes: p.notes,
              transactions: p.transactions ?? [],
              currency: p.currency,
            };
          })
          .filter((p): p is SavedPortfolio => p !== null);

        setSavedPortfolios(formattedData);
      } else {
        setSavedPortfolios([]);
      }

    } catch (error) {
      const postgrestError = error as PostgrestError;
      console.error('Error fetching portfolios:', postgrestError.message);
      if (postgrestError.details) console.error('Details:', postgrestError.details);
      if (postgrestError.hint) console.error('Hint:', postgrestError.hint);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPortfolios();
    } else {
      setSavedPortfolios([]); // Clear portfolios on logout
    }
  }, [user]);

  const savePortfolio = async (name: string, assets: Asset[], result: OptimizationResult, mcmcResult: MCMCResult | null, notes?: string, transactions?: Transaction[], currency?: Currency) => {
    if (!user) {
        alert("You must be logged in to save a portfolio.");
        return;
    }
    try {
        let mcmcResultToSave = null;
        if (mcmcResult) {
            // THE FIX: Create a copy of the MCMC result but exclude the massive simulations array
            // This prevents the browser from freezing when serializing the large JSON payload for the API request.
            mcmcResultToSave = {
                ...mcmcResult,
                simulations: [], 
            };
        }

        const { error } = await supabase
            .from('Portfolio')
            .insert({ 
                name, 
                result, 
                mcmc_result: mcmcResultToSave, 
                user_id: user.id,
                notes,
                transactions,
                currency,
            } as any);

      if (error) throw error;
      
      // Refresh the list after saving
      await fetchPortfolios();

    } catch (error) {
      const postgrestError = error as PostgrestError;
      console.error('Error saving portfolio:', postgrestError.message);
      alert(`There was an error saving your portfolio: ${postgrestError.message}`);
    }
  };

  const deletePortfolio = async (id: number) => {
    if (!user) return;
    try {
        const { error } = await supabase
            .from('Portfolio')
            .delete()
            .match({ id: id, user_id: user.id });

        if (error) throw error;

        setSavedPortfolios(prev => prev.filter(p => p.id !== id));

    } catch (error) {
        const postgrestError = error as PostgrestError;
        console.error('Error deleting portfolio:', postgrestError.message);
    }
  };

  return (
    <SavedPortfoliosContext.Provider value={{ savedPortfolios, savePortfolio, deletePortfolio, loading }}>
      {children}
    </SavedPortfoliosContext.Provider>
  );
};

export const useSavedPortfolios = () => {
  const context = useContext(SavedPortfoliosContext);
  if (context === undefined) {
    throw new Error('useSavedPortfolios must be used within a SavedPortfoliosProvider');
  }
  return context;
};
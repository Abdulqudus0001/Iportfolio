import { useState, useEffect, useCallback } from 'react';

const WATCHLIST_STORAGE_KEY = 'iportfolio-watchlist';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    try {
      const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      console.error("Failed to parse watchlist from localStorage", error);
      return new Set();
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(watchlist)));
    } catch (error) {
        console.error("Failed to save watchlist to localStorage", error);
    }
  }, [watchlist]);

  const toggleWatchlist = useCallback((ticker: string) => {
    setWatchlist(prev => {
      const newWatchlist = new Set(prev);
      if (newWatchlist.has(ticker)) {
        newWatchlist.delete(ticker);
      } else {
        newWatchlist.add(ticker);
      }
      return newWatchlist;
    });
  }, []);

  const isOnWatchlist = useCallback((ticker: string) => {
      return watchlist.has(ticker);
  }, [watchlist]);

  return { watchlist, toggleWatchlist, isOnWatchlist };
};

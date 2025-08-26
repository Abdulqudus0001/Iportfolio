import { useState, useEffect } from 'react';

const FIRST_VISIT_KEY = 'iportfolio-first-visit';

export const useFirstVisit = () => {
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FIRST_VISIT_KEY);
      if (stored === null) {
        setIsFirstVisit(true);
        window.localStorage.setItem(FIRST_VISIT_KEY, 'false');
      }
    } catch (error) {
      console.error("Could not access localStorage", error);
      // Fail gracefully if localStorage is disabled
    }
  }, []);

  const closeTour = () => {
    setIsFirstVisit(false);
  };

  return { isFirstVisit, closeTour };
};

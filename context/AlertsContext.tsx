import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Alert, RebalancingAlert } from '../types';

interface AlertsContextType {
  priceAlerts: Alert[];
  rebalancingAlerts: RebalancingAlert[];
  addPriceAlert: (alert: Alert) => void;
  deletePriceAlert: (id: string) => void;
  addRebalancingAlert: (alert: RebalancingAlert) => void;
  deleteRebalancingAlert: (id: string) => void;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export const AlertsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [priceAlerts, setPriceAlerts] = useState<Alert[]>([]);
  const [rebalancingAlerts, setRebalancingAlerts] = useState<RebalancingAlert[]>([]);

  const addPriceAlert = (alert: Alert) => setPriceAlerts(prev => [...prev, alert]);
  const deletePriceAlert = (id: string) => setPriceAlerts(prev => prev.filter(a => a.id !== id));
  
  const addRebalancingAlert = (alert: RebalancingAlert) => setRebalancingAlerts(prev => [...prev, alert]);
  const deleteRebalancingAlert = (id: string) => setRebalancingAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <AlertsContext.Provider value={{
      priceAlerts,
      rebalancingAlerts,
      addPriceAlert,
      deletePriceAlert,
      addRebalancingAlert,
      deleteRebalancingAlert
    }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
};
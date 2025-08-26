
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { UserTier } from '../types';

interface UserTierContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
}

const UserTierContext = createContext<UserTierContextType | undefined>(undefined);

export const UserTierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tier, setTier] = useState<UserTier>(UserTier.Advanced);

  return (
    <UserTierContext.Provider value={{ tier, setTier }}>
      {children}
    </UserTierContext.Provider>
  );
};

export const useUserTier = () => {
  const context = useContext(UserTierContext);
  if (context === undefined) {
    throw new Error('useUserTier must be used within a UserTierProvider');
  }
  return context;
};
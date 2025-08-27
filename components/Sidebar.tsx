import React, { useState } from 'react';
import { useUserTier } from '../context/UserTierContext';
import { UserTier, View } from '../types';
import Modal from './ui/Modal';
import ExplainerVideo from './ExplainerVideo';
import { useSavedPortfolios } from '../context/SavedPortfoliosContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  openLearnModal: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, openLearnModal, isOpen, setIsOpen }) => {
  const { tier, setTier } = useUserTier();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { savedPortfolios, deletePortfolio } = useSavedPortfolios();
  const { loadPortfolio, clearPortfolio } = usePortfolio();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();


  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'assets', label: 'Asset Browser', icon: <AssetIcon /> },
    { id: 'portfolio', label: 'Portfolio', icon: <PortfolioIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
    { id: 'comparison', label: 'Comparison', icon: <CompareIcon /> },
    { id: 'community', label: 'Community', icon: <CommunityIcon /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertsIcon /> },
  ];

  const handleNavigation = (view: View) => {
    setCurrentView(view);
    setIsOpen(false);
  };

  const handleLoadPortfolio = (portfolio: (typeof savedPortfolios)[0]) => {
      loadPortfolio(portfolio);
      setCurrentView('portfolio');
      setIsOpen(false);
  }
  
  const handleNewPortfolio = () => {
      clearPortfolio();
      setCurrentView('portfolio');
      setIsOpen(false);
  }

  const handleAuthClick = () => {
    setCurrentView('auth');
    setIsOpen(false);
  };


  return (
    <>
    <aside className={`
      fixed inset-y-0 left-0 z-40
      w-72 bg-light-card dark:bg-dark-card shadow-lg flex flex-col
      transition-transform duration-300 ease-in-out
      md:relative md:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-brand-primary">iPortfolio</h2>
         <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button 
                className="md:hidden p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
                aria-label="Close sidebar"
            >
                <CloseIcon />
            </button>
         </div>
      </div>
      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            className={`w-full flex items-center p-3 rounded-lg text-left transition-colors ${
              currentView === item.id
                ? 'bg-brand-secondary text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-primary'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
        
        <div className="pt-4 mt-4 border-t dark:border-gray-700">
          <h3 className="px-3 text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">My Portfolios</h3>
          <button onClick={handleNewPortfolio} className="w-full flex items-center p-3 rounded-lg text-left text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-primary">
            <span className="mr-3"><NewIcon /></span>
            <span className="font-medium">New Portfolio</span>
          </button>
          <div className="max-h-48 overflow-y-auto">
            {savedPortfolios.map(p => (
                <div key={p.id} className="group w-full flex items-center justify-between p-3 rounded-lg text-left text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-primary">
                    <button onClick={() => handleLoadPortfolio(p)} className="flex-grow text-left truncate">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="block text-xs">{new Date(p.created_at).toLocaleDateString()}</span>
                    </button>
                    <button onClick={() => deletePortfolio(p.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2">
                        <DeleteIcon />
                    </button>
                </div>
            ))}
          </div>
        </div>

      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
         {user ? (
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-center">
                <p className="text-sm font-medium truncate" title={user.email}>{user.email}</p>
                <button onClick={signOut} className="text-xs text-red-500 hover:underline">Sign Out</button>
            </div>
        ) : (
            <div className="p-2">
                <Button onClick={handleAuthClick} className="w-full">
                    Sign In / Sign Up
                </Button>
            </div>
        )}
        <div className="flex space-x-2">
            <button 
              onClick={() => setIsVideoOpen(true)}
              className="w-1/2 flex items-center justify-center p-2 rounded-lg text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-medium transition-colors"
            >
              <PlayIcon /> Watch
            </button>
             <button 
              onClick={openLearnModal}
              className="w-1/2 flex items-center justify-center p-2 rounded-lg text-sm bg-blue-100 hover:bg-blue-200 text-brand-primary dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 font-medium transition-colors"
            >
              <LearnIcon /> Learn Hub
            </button>
        </div>
        <div>
          <label htmlFor="user-tier" className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">User Tier</label>
          <select
            id="user-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as UserTier)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-dark-card dark:border-gray-600 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            {Object.values(UserTier).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-tight">
            Disclaimer: This tool is for informational purposes only and does not constitute investment advice.
        </p>
      </div>
    </aside>
    <Modal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} title="iPortfolio Explainer">
        <ExplainerVideo />
    </Modal>
    </>
  );
};

// SVG Icon Components
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const PortfolioIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const AnalyticsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>;
const AssetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const CommunityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a3.002 3.002 0 013.39-2.433M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 0c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" /></svg>;
const AlertsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const LearnIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const NewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const CompareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

export default Sidebar;
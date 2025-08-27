import React, { useState, useEffect } from 'react';
import { UserTierProvider } from './context/UserTierContext';
import { PortfolioProvider } from './context/PortfolioContext';
import { SavedPortfoliosProvider } from './context/SavedPortfoliosContext';
import { AlertsProvider } from './context/AlertsContext';
import Sidebar from './components/Sidebar';
import AssetBrowser from './components/AssetBrowser';
import PortfolioView from './components/PortfolioView';
import AnalyticsView from './components/AnalyticsView';
import AlertsView from './components/AlertsView';
import GuidedTour from './components/GuidedTour';
import AIChatBot from './components/AIChatBot';
import LearnModal from './components/LearnModal';
import { useFirstVisit } from './hooks/useFirstVisit';
import { View } from './types';
import DashboardView from './components/DashboardView';
import CommunityView from './components/CommunityView';
import { ThemeProvider } from './context/ThemeContext';
import { FinancialGoalsProvider } from './context/FinancialGoalsContext';
import { AuthProvider } from './context/AuthContext';
import AuthView from './components/AuthView';
import ComparisonView from './components/ComparisonView';
import Tooltip from './components/ui/Tooltip';
import SharedPortfolioView from './components/SharedPortfolioView';

const AppContent: React.FC = () => {
  const { isFirstVisit, closeTour } = useFirstVisit();
  const [isLearnModalOpen, setIsLearnModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('share');
      if (id) {
          setShareId(id);
      }
  }, []);

  const openAiChat = (prompt?: string) => {
      setAiInitialPrompt(prompt);
      setIsAiChatOpen(true);
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView setCurrentView={setCurrentView} />;
      case 'assets':
        return <AssetBrowser openAiChat={openAiChat} />;
      case 'portfolio':
        return <PortfolioView setCurrentView={setCurrentView} />;
      case 'analytics':
        return <AnalyticsView openAiChat={openAiChat}/>;
      case 'community':
        return <CommunityView setCurrentView={setCurrentView} />;
      case 'alerts':
        return <AlertsView />;
      case 'comparison':
        return <ComparisonView />;
      case 'auth':
        return <AuthView />;
      default:
        return <DashboardView setCurrentView={setCurrentView} />;
    }
  };

  const pageTitles: Record<View, string> = {
    dashboard: 'Your personal investment dashboard.',
    assets: 'Browse, search, and watchlist real-time market assets.',
    portfolio: 'Manually enter, analyze, and track your investment portfolio.',
    analytics: 'Dive deep into portfolio composition, risk, and correlation.',
    community: 'Explore and load pre-built portfolio strategy ideas.',
    alerts: 'Manage personalized alerts for your portfolio assets.',
    comparison: 'Compare saved portfolios side-by-side.',
    auth: 'Sign in or create an account to save and sync portfolios.'
  };

  const handleExplainView = () => {
      const prompt = `Please explain the purpose and main features of the "${currentView}" page of the iPortfolio application. Keep it concise and easy for a beginner to understand.`;
      openAiChat(prompt);
  }
  
  if (shareId) {
    return <SharedPortfolioView shareId={shareId} />;
  }

  return (
    <>
      {isFirstVisit && <GuidedTour onClose={closeTour} />}
      <LearnModal isOpen={isLearnModalOpen} onClose={() => setIsLearnModalOpen(false)} />
      
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      <div className="relative flex h-screen bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text font-sans">
        <Sidebar 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          openLearnModal={() => setIsLearnModalOpen(true)}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
           <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button 
                            className="md:hidden p-2 -ml-2 text-light-text-secondary dark:text-dark-text-secondary"
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Open sidebar"
                        >
                            <MenuIcon />
                        </button>
                        <h1 className="text-3xl font-bold text-brand-primary">iPortfolio</h1>
                    </div>
                   <Tooltip text="Explain This View">
                       <button onClick={handleExplainView} className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <MagicWandIcon />
                       </button>
                   </Tooltip>
                </div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                  {pageTitles[currentView]}
                </p>
                {renderView()}
           </div>
        </main>
        <button
            onClick={() => openAiChat()}
            className="fixed bottom-6 right-6 bg-brand-primary text-white rounded-full p-4 shadow-lg hover:bg-brand-secondary transition-transform transform hover:scale-110 focus:outline-none z-40"
            aria-label="Open AI Assistant"
        >
            <BotIcon />
        </button>
        <AIChatBot 
            isOpen={isAiChatOpen}
            onClose={() => setIsAiChatOpen(false)}
            initialPrompt={aiInitialPrompt}
            setCurrentView={setCurrentView}
        />
      </div>
    </>
  );
}

const MagicWandIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 10l-4.5 4.5" />
    </svg>
);
const BotIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;

const MenuIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);


const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserTierProvider>
          <PortfolioProvider>
            <SavedPortfoliosProvider>
              <FinancialGoalsProvider>
                <AlertsProvider>
                  <AppContent />
                </AlertsProvider>
              </FinancialGoalsProvider>
            </SavedPortfoliosProvider>
          </PortfolioProvider>
        </UserTierProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, FinancialRatio, Financials, PriceSummary, UserTier, DataSource, NewsArticle } from '../types';
import { marketDataService } from '../services/marketDataService';
import Card from './ui/Card';
import Loader from './ui/Loader';
import PriceChart from './PriceChart';
import AdSenseBanner from './AdSenseBanner';
import { useUserTier } from '../context/UserTierContext';
import { useWatchlist } from '../hooks/useWatchlist';
import Tooltip from './ui/Tooltip';
import InfoIcon from './ui/InfoIcon';
import Button from './ui/Button';
import { useDebounce } from '../hooks/useDebounce';

const ratioDefinitions: Record<string, string> = {
    'P/E (TTM)': "Price-to-Earnings Ratio. A measure of a company's stock price relative to its earnings per share over the last 12 months. A high P/E could mean the stock is overvalued, or that investors expect high growth rates.",
    'P/B': "Price-to-Book Ratio. Compares a company's market capitalization to its book value. A lower P/B could indicate an undervalued stock.",
    'Dividend Yield': "The ratio of a company's annual dividend per share to its current stock price, expressed as a percentage. It shows how much a company pays out in dividends each year relative to its stock price.",
    'Market Cap': "Market Capitalization. The total market value of a company's outstanding shares of stock. Calculated as Stock Price × Number of Shares Outstanding.",
    'EPS (TTM)': "Earnings Per Share (Trailing Twelve Months). A company's profit divided by the outstanding shares of its common stock. It serves as an indicator of a company's profitability.",
    'Beta': "A measure of a stock's volatility in relation to the overall market. A beta greater than 1 indicates the stock is more volatile than the market, while a beta less than 1 means it is less volatile."
};

interface AssetBrowserProps {
  openAiChat: (prompt: string) => void;
}

type SortKey = 'ticker' | 'name' | 'price';

const SortButton: React.FC<{
    label: string;
    sortKey: SortKey;
    activeSort: { key: SortKey; direction: 'asc' | 'desc' };
    onClick: (key: SortKey) => void;
}> = ({ label, sortKey, activeSort, onClick }) => {
    const isActive = activeSort.key === sortKey;
    return (
        <button
            onClick={() => onClick(sortKey)}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                isActive
                    ? 'bg-brand-secondary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
        >
            {label} {isActive && (activeSort.direction === 'asc' ? '▲' : '▼')}
        </button>
    );
};

const SUPPORTED_COUNTRIES: Asset['country'][] = ['US', 'UK', 'SAUDI ARABIA', 'QATAR', 'NIGERIA', 'CRYPTO'];

const AssetBrowser: React.FC<AssetBrowserProps> = ({ openAiChat }) => {
  const { tier } = useUserTier();
  const [masterAssetList, setMasterAssetList] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [assetData, setAssetData] = useState<{ ratios: FinancialRatio[], financials: Financials, summary: PriceSummary, news: NewsArticle[] } | null>(null);
  const { isOnWatchlist, toggleWatchlist } = useWatchlist();
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'ticker', direction: 'asc' });


  const isProOrHigher = tier === UserTier.Professional || tier === UserTier.Advanced;

  useEffect(() => {
    marketDataService.getAvailableAssets()
        .then(assets => {
            setMasterAssetList(assets);
            if (assets.length > 0) {
                // Select the first asset by default
                const firstAsset = assets.sort((a,b) => a.ticker.localeCompare(b.ticker))[0];
                setSelectedAsset(firstAsset);
            }
        })
        .catch(err => {
            console.error(err);
            setError("Could not load the list of available assets. The financial data provider might be temporarily unavailable.");
        })
        .finally(() => setIsLoadingList(false));
  }, []);

  useEffect(() => {
    if (selectedAsset) {
      setIsLoadingDetails(true);
      setError(null);
      setAssetData(null);
      
      Promise.allSettled([
        marketDataService.getFinancialRatios(selectedAsset.ticker),
        marketDataService.getFinancialsSnapshot(selectedAsset.ticker),
        marketDataService.getAssetPriceSummary(selectedAsset.ticker),
        marketDataService.getAssetNews(selectedAsset.ticker),
      ]).then(([ratiosResult, financialsResult, summaryResult, newsResult]) => {
        
        // Handle summary - this one is critical for the view to be useful
        if (summaryResult.status === 'rejected') {
            throw new Error(summaryResult.reason?.message || `Could not load critical price data for ${selectedAsset.ticker}.`);
        }
        const summary = summaryResult.value.data;

        // Handle ratios - non-critical, can fail gracefully
        const ratios = ratiosResult.status === 'fulfilled' ? ratiosResult.value.data : [];
        if (ratiosResult.status === 'rejected') console.warn(`Financial ratios failed to load for ${selectedAsset.ticker}:`, ratiosResult.reason);

        // Handle financials - non-critical, can fail gracefully
        const financials = financialsResult.status === 'fulfilled' ? financialsResult.value.data : { income: [], balanceSheet: [], cashFlow: [], asOf: 'N/A' };
        if (financialsResult.status === 'rejected') console.warn(`Financials snapshot failed to load for ${selectedAsset.ticker}:`, financialsResult.reason);
        
        // Handle News - non-critical
        const news = newsResult.status === 'fulfilled' ? newsResult.value.data : [];
        if (newsResult.status === 'rejected') console.warn(`News failed to load for ${selectedAsset.ticker}:`, newsResult.reason);

        const hasMeaningfulData = summary.close > 0 || ratios.length > 0;

        if (!hasMeaningfulData) {
            setError(`Detailed data for assets like ${selectedAsset.ticker} may be limited.`);
            setAssetData(null);
        } else {
            setAssetData({ ratios, financials, summary, news });
        }
      }).catch(err => {
          console.error(`Failed to fetch critical data for ${selectedAsset.ticker}`, err);
          const defaultError = `Sorry, we couldn't load details for ${selectedAsset.ticker}. The data provider might be busy or does not support this asset.`;
          setError(err.message || defaultError);
      }).finally(() => setIsLoadingDetails(false));
    }
  }, [selectedAsset]);

  const filterOptions = useMemo(() => {
    if (isLoadingList) return { countries: [], sectors: [] };
    const sectors = [...new Set(masterAssetList.map(a => a.sector).filter(Boolean))].sort();
    return { countries: SUPPORTED_COUNTRIES, sectors };
  }, [masterAssetList, isLoadingList]);

  const sortedAndFilteredAssets = useMemo(() => {
    if (isLoadingList) return [];
    
    const filtered = masterAssetList.filter(asset => {
        const matchesSearch = (asset.name?.toLowerCase() || '').includes(debouncedSearchTerm.toLowerCase()) ||
                              (asset.ticker?.toLowerCase() || '').includes(debouncedSearchTerm.toLowerCase());
        const matchesWatchlist = !showWatchlistOnly || isOnWatchlist(asset.ticker);
        const matchesCountry = selectedCountry === 'all' || asset.country === selectedCountry;
        const matchesSector = selectedSector === 'all' || asset.sector === selectedSector;
        return matchesSearch && matchesWatchlist && matchesCountry && matchesSector;
    });

    return [...filtered].sort((a, b) => {
        const { key, direction } = sortConfig;
        
        let valA, valB;

        if (key === 'price') {
            valA = a.price;
            valB = b.price;
            // Handle undefined prices: always sort them to the bottom
            if (valA == null) return 1;
            if (valB == null) return -1;
        } else { // ticker or name
            valA = (a[key] || '').toLowerCase();
            valB = (b[key] || '').toLowerCase();
        }

        if (valA < valB) {
            return direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
  }, [debouncedSearchTerm, showWatchlistOnly, isOnWatchlist, masterAssetList, isLoadingList, selectedCountry, selectedSector, sortConfig]);

  const handleSort = (key: SortKey) => {
    if (sortConfig.key === key) {
        setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
        setSortConfig({ key, direction: 'asc' });
    }
  };

  const handleFindAlternatives = () => {
    const prompt = `I'm looking for an asset similar to "${searchTerm}", but I can't find it. Can you suggest 3-5 alternative stocks or ETFs from available markets (US, UK, Saudi Arabia, Qatar, Crypto) that have a similar profile (e.g., same industry, similar market cap, or investment theme)? For each suggestion, briefly explain why it's a good alternative and provide its ticker symbol if you know it.`;
    openAiChat(prompt);
  };

  const SummaryItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
        <span className="text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
        <span className="font-semibold">{value}</span>
    </div>
  );
  
  const LiquidityBadge: React.FC<{ liquidity: 'High' | 'Medium' | 'Low' | undefined }> = ({ liquidity }) => {
    if (!liquidity) return null;
    const colors = {
        High: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        Low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colors[liquidity]}`}>{liquidity} Liquidity</span>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 h-full flex flex-col">
        <h3 className="text-xl font-semibold text-brand-primary mb-4">Asset List</h3>
        <div className="mb-4 space-y-3">
            <input
              type="text"
              placeholder="Search by name or ticker..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600"
            />
             <div className="flex gap-2">
                <select
                    value={selectedCountry}
                    onChange={e => setSelectedCountry(e.target.value)}
                    className="w-1/2 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600 text-sm"
                >
                    <option value="all">All Countries</option>
                    {filterOptions.countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={selectedSector}
                    onChange={e => setSelectedSector(e.target.value)}
                    className="w-1/2 p-2 border border-gray-300 rounded-md dark:bg-dark-bg dark:border-gray-600 text-sm"
                >
                    <option value="all">All Sectors</option>
                    {filterOptions.sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <label className="flex items-center pt-1 text-sm text-gray-600 dark:text-dark-text-secondary">
                <input
                    type="checkbox"
                    checked={showWatchlistOnly}
                    onChange={(e) => setShowWatchlistOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-accent"
                />
                <span className="ml-2">Show Watchlist Only</span>
            </label>
            <div className="flex items-center gap-2 text-sm pt-2 border-t dark:border-gray-700">
                <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">Sort by:</span>
                <SortButton label="Ticker" sortKey="ticker" activeSort={sortConfig} onClick={handleSort} />
                <SortButton label="Name" sortKey="name" activeSort={sortConfig} onClick={handleSort} />
                <SortButton label="Price" sortKey="price" activeSort={sortConfig} onClick={handleSort} />
            </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoadingList ? (
             <Loader message="Loading assets..." />
          ) : sortedAndFilteredAssets.length > 0 ? (
            <ul>
                {sortedAndFilteredAssets.slice(0, 200).map(asset => ( // Limit to 200 for performance
                <li key={asset.ticker}
                    className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedAsset?.ticker === asset.ticker ? 'bg-brand-secondary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                    <div onClick={() => setSelectedAsset(asset)} className="flex-grow">
                        <div className="font-bold">{asset.ticker}</div>
                        <div className="text-sm opacity-80">{asset.name}</div>
                    </div>
                    {asset.price != null && <span className="font-mono text-sm px-2">${asset.price.toFixed(2)}</span>}
                    <button onClick={() => toggleWatchlist(asset.ticker)} className="p-1 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-700">
                        <StarIcon filled={isOnWatchlist(asset.ticker)} />
                    </button>
                </li>
                ))}
            </ul>
           ) : (
            <div className="text-center py-10 px-4">
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                {error || "No assets found matching your criteria."}
              </p>
              {searchTerm && !error && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <h4 className="font-semibold text-brand-primary">Can't find your asset?</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 my-2">
                    Our AI can suggest similar alternatives from available markets.
                  </p>
                  <Button onClick={handleFindAlternatives}>
                    <div className="flex items-center gap-2">
                        <MagicWandIcon /> <span>Find Alternatives</span>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
      
      <div className="md:col-span-2 space-y-6">
        {selectedAsset ? (
          <>
            <Card isLoading={isLoadingDetails}>
                 <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-primary">{selectedAsset.name} ({selectedAsset.ticker})</h2>
                         <div className="flex items-center gap-2 mt-1">
                             <p className="text-light-text-secondary dark:text-dark-text-secondary">{selectedAsset.sector} - {selectedAsset.country}</p>
                             <LiquidityBadge liquidity={selectedAsset.liquidity} />
                         </div>
                    </div>
                     <div className="text-right">
                         <p className="text-2xl font-bold">{assetData?.summary ? `$${assetData.summary.close.toFixed(2)}` : '...'}</p>
                     </div>
                </div>
            </Card>

            {error && !isLoadingDetails && (
                <Card>
                    <div className="text-center py-4 px-4">
                        <p className="text-red-500">{error}</p>
                    </div>
                </Card>
            )}

            {!isLoadingDetails && !error && assetData && (
                <>
                    <Card title="Daily Price Summary">
                        {assetData.summary.close > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                                <SummaryItem label="Open" value={`$${assetData.summary.open.toFixed(2)}`} />
                                <SummaryItem label="High" value={`$${assetData.summary.high.toFixed(2)}`} />
                                <SummaryItem label="Close" value={`$${assetData.summary.close.toFixed(2)}`} />
                                <SummaryItem label="Low" value={`$${assetData.summary.low.toFixed(2)}`} />
                                <SummaryItem label="Volume" value={assetData.summary.volume} />
                            </div>
                        ) : <p className="text-sm text-center text-gray-500">Price summary data is not available.</p>}
                    </Card>

                    <Card title="Price Chart (1 Year)">
                        <PriceChart ticker={selectedAsset.ticker} />
                    </Card>

                    <Card title="Recent News">
                        {assetData.news.length > 0 ? (
                             <div className="space-y-4 max-h-72 overflow-y-auto pr-2 text-sm">
                                {assetData.news.map((item, index) => (
                                    <div key={index} className="border-b dark:border-gray-700 pb-3 last:border-b-0">
                                        <h4 className="font-bold text-base text-light-text dark:text-dark-text">{item.title}</h4>
                                        <p className="text-xs italic text-gray-500 dark:text-gray-400">{item.source}</p>
                                        <p className="my-1 text-light-text-secondary dark:text-dark-text-secondary">{item.summary}</p>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-secondary hover:underline">
                                            Read More &rarr;
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-center text-gray-500">No recent news found for this asset.</p>}
                    </Card>
                    
                    <AdSenseBanner 
                        data-ad-client="ca-pub-5175221516557079"
                        data-ad-slot="7798554143"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Key Ratios">
                            {assetData.ratios.length > 0 ? (
                                <ul className="space-y-2">
                                    {assetData.ratios.map(ratio => (
                                        <li key={ratio.label} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary">
                                                <span>{ratio.label}</span>
                                                <Tooltip text={ratioDefinitions[ratio.label] || 'No definition available.'}>
                                                    <InfoIcon />
                                                </Tooltip>
                                            </div>
                                            <span className="font-semibold">{ratio.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-center text-gray-500">Key ratios are not available for this asset.</p>}
                        </Card>
                        <Card title={`Financials Snapshot (As of ${assetData.financials.asOf})`}>
                           {assetData.financials.income.length > 0 || assetData.financials.balanceSheet.length > 0 ? (
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-bold mb-1">Income Statement</h4>
                                        {assetData.financials.income.map(item => <p key={item.metric} className="flex justify-between text-sm"><span>{item.metric}:</span> <span>{item.value}</span></p>)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">Balance Sheet</h4>
                                        {assetData.financials.balanceSheet.map(item => <p key={item.metric} className="flex justify-between text-sm"><span>{item.metric}:</span> <span>{item.value}</span></p>)}
                                    </div>
                                </div>
                           ) : <p className="text-sm text-center text-gray-500">Financials are not available for this asset.</p>}
                        </Card>
                    </div>
                </>
            )}
          </>
        ) : !isLoadingList && !error ? (
          <Card>
            <p className="text-center py-16">Select an asset from the list to view details.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${filled ? 'text-yellow-400' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

const MagicWandIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 10l-4.5 4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13l-1.5 1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5l1 1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.5 5.5l-1 1" />
    </svg>
);


export default AssetBrowser;
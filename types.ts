export enum UserTier {
  Basic = 'Basic',
  Professional = 'Professional',
  Advanced = 'Advanced',
}

export enum PortfolioTemplate {
    Balanced = 'Balanced',
    Aggressive = 'Aggressive',
    Custom = 'Custom',
}

export enum Goal {
    Retirement = 'Retirement',
    WealthGrowth = 'Wealth Growth',
    DownPayment = 'Down Payment',
}

export interface GoalSettings {
    goal: Goal;
    timeline: number; // in years
    riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive';
}

export interface Asset {
  ticker: string;
  name: string;
  country: 'US' | 'UK' | 'QATAR' | 'NIGERIA' | 'SAUDI ARABIA' | 'CRYPTO';
  sector: string;
  asset_class: 'EQUITY' | 'CRYPTO' | 'BENCHMARK';
  price?: number;
  is_shariah_compliant?: boolean;
  liquidity?: 'High' | 'Medium' | 'Low';
}

export interface PortfolioAsset extends Asset {
  weight: number;
}

export interface PriceSummary {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: string;
}

export interface FinancialRatio {
    label: string;
    value: string | number;
}

export interface FinancialStatementItem {
    metric: string;
    value: string;
}

export interface Financials {
    income: FinancialStatementItem[];
    balanceSheet: FinancialStatementItem[];
    cashFlow: FinancialStatementItem[];
    asOf: string;
}

export interface PriceDataPoint {
    date: string;
    price: number;
}

export interface SimulationPoint {
    returns: number;
    volatility: number;
    sharpeRatio: number;
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR' | 'NGN' | 'QAR' | 'SAR';
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'NGN', 'QAR', 'SAR'];

export type DataSource = 'live' | 'cache' | 'static';

export interface OptimizationResult {
    weights: PortfolioAsset[];
    returns: number;
    volatility: number;
    sharpeRatio: number;
    realReturn?: number;
    currency?: Currency;
    source?: DataSource;
}

export interface MCMCResult {
    simulations: SimulationPoint[];
    bestSharpe: OptimizationResult;
    averageWeights: PortfolioAsset[];
    source?: DataSource;
}

export interface CorrelationData {
    assets: string[];
    matrix: number[][];
}

export interface ContributionData {
    ticker: string;
    returnContribution: number;
    riskContribution: number;
}

export interface SavedPortfolio {
    id: number;
    name: string;
    created_at: string;
    result: OptimizationResult;
    mcmc_result?: MCMCResult | null;
    template?: PortfolioTemplate;
    description?: string;
    notes?: string;
    transactions?: Transaction[];
    currency?: Currency;
}

export interface ConstraintOptions {
    maxAssetWeight?: number; // as a decimal, e.g., 0.1 for 10%
    maxSectorWeight?: number; // as a decimal
}

export interface BacktestResult {
    dates: string[];
    portfolioValues: number[];
    benchmarkValues: number[];
    totalReturn: number;
    benchmarkReturn: number;
    maxDrawdown: number;
}

export interface Scenario {
    id: string;
    name: string;
    description: string;
    // Sector impacts as multipliers, e.g., Tech: 0.8 means a 20% reduction in expected return
    impact: Record<string, number>; 
}

export interface ScenarioResult {
    originalReturn: number;
    scenarioReturn: number;
    impactPercentage: number;
}

export interface Alert {
    id: string;
    ticker: string;
    condition: 'price_above' | 'price_below' | 'vol_above';
    value: number;
    createdAt: string;
}

export interface FactorExposures {
    beta: number; // Market
    smb: number; // Size
    hml: number; // Value
}

export interface VaRResult {
    var95: number; // Value at Risk at 95% confidence
    cvar95: number; // Conditional VaR at 95% confidence
    portfolioValue: number;
}

export interface TaxLossHarvestingCandidate {
    ticker: string;
    unrealizedLoss: number;
    currentValue: number;
}

export interface TaxLossHarvestingResult {
    candidates: TaxLossHarvestingCandidate[];
    potentialTaxSavings: number;
}

export interface RebalancingAlert {
    id: string;
    type: 'sector' | 'asset_class';
    target: string; // e.g., 'Technology' or 'CRYPTO'
    maxWeight: number; // as percentage
    createdAt: string;
}

export interface Transaction {
    id: string;
    ticker: string;
    date: string;
    quantity: number;
    price: number;
    type: 'BUY' | 'SELL';
}

export interface FinancialGoal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string;
    linkedPortfolioId?: string;
}

export enum OptimizationModel {
    MaximizeSharpe = 'Maximize Sharpe Ratio',
    MinimizeVolatility = 'Minimize Volatility',
    RiskParity = 'Risk Parity',
    BlackLitterman = 'Black-Litterman',
}

export interface BlackLittermanView {
    id: string;
    asset_ticker_1: string;
    direction: 'outperform' | 'underperform';
    asset_ticker_2: string; // Ticker for relative view
    expected_return_diff: number; // as decimal, e.g., 0.02 for 2%
    confidence: number; // 0 to 1
}

export type View = 'dashboard' | 'assets' | 'portfolio' | 'analytics' | 'community' | 'alerts' | 'comparison' | 'auth';

export interface NewsArticle {
    title: string;
    source: string;
    summary: string;
    url: string;
}


// --- NEW TYPES ---
export interface Budget {
    income: number;
    expenses: number;
}

export interface DividendInfo {
    ticker: string;
    yield: number;
    amountPerShare: number;
    payDate: string;
    projectedAnnualIncome: number;
}

export interface OptionContract {
    expirationDate: string;
    strikePrice: number;
    lastPrice: number;
    type: 'call' | 'put';
}
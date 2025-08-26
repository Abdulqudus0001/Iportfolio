import { Scenario, SavedPortfolio, PortfolioTemplate, Asset, PortfolioAsset } from './types';

export const SCENARIOS: Scenario[] = [
    {
        id: 'tech_crash',
        name: 'Tech Bubble Crash',
        description: 'Simulates a sharp downturn in the technology and communication sectors.',
        impact: {
            'Technology': 0.65, // 35% reduction
            'Communication Services': 0.75,
            'Consumer Cyclical': 0.85,
        }
    },
    {
        id: 'oil_shock',
        name: 'Oil Price Spike',
        description: 'Simulates a sudden, sharp increase in oil prices, benefiting energy stocks.',
        impact: {
            'Energy': 1.4, // 40% increase
            'Industrials': 0.9,
            'Consumer Cyclical': 0.85,
        }
    },
    {
        id: 'interest_hike',
        name: 'Aggressive Interest Rate Hike',
        description: 'Simulates the effect of central banks raising interest rates to combat inflation.',
        impact: {
            'Financial Services': 1.1,
            'Real Estate': 0.7,
            'Technology': 0.8,
            'Utilities': 0.9,
        }
    },
    {
        id: 'inflation_shock',
        name: 'High Inflation & Rising Rates',
        description: 'Simulates a persistent high-inflation environment, hurting growth stocks and benefiting value/materials.',
        impact: {
            'Technology': 0.8,
            'Consumer Defensive': 1.1,
            'Basic Materials': 1.2,
            'Real Estate': 0.75,
            'Financial Services': 1.05,
        }
    },
     {
        id: 'stagflation',
        name: 'Stagflation',
        description: 'Simulates economic stagnation combined with inflation, a challenging environment for most assets.',
        impact: {
            'Technology': 0.75,
            'Consumer Cyclical': 0.7,
            'Industrials': 0.8,
            'Energy': 1.1,
            'Utilities': 1.05,
            'Basic Materials': 1.1,
        }
    }
];


export const COMMUNITY_PORTFOLIOS: SavedPortfolio[] = [
    {
        id: 1001,
        name: 'Global Tech Growth',
        description: 'A high-growth portfolio focused on leading technology companies and crypto assets.',
        template: PortfolioTemplate.Aggressive,
        created_at: new Date('2023-10-26').toISOString(),
        result: {
            weights: [
                { ticker: 'AAPL', name: 'Apple Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.20 },
                { ticker: 'MSFT', name: 'Microsoft Corp.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.20 },
                { ticker: 'GOOGL', name: 'Alphabet Inc.', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.15 },
                { ticker: 'AMZN', name: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', weight: 0.15 },
                { ticker: 'TSM', name: 'Taiwan Semiconductor', country: 'US', sector: 'Technology', asset_class: 'EQUITY', weight: 0.10 },
                { ticker: 'ETH', name: 'Ethereum', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', weight: 0.10 },
                { ticker: 'SOL', name: 'Solana', country: 'CRYPTO', sector: 'Cryptocurrency', asset_class: 'CRYPTO', weight: 0.10 },
            ] as PortfolioAsset[],
            returns: 0.225,
            volatility: 0.28,
            sharpeRatio: 0.73
        },
    },
    {
        id: 1002,
        name: 'Diversified Income (ESG)',
        description: 'A portfolio focused on stable, dividend-paying companies with strong ESG ratings for sustainable, long-term growth.',
        template: PortfolioTemplate.ESG,
        created_at: new Date('2023-11-15').toISOString(),
        result: {
            weights: [
                 { ticker: 'NEE', name: 'NextEra Energy', country: 'US', sector: 'Utilities', asset_class: 'EQUITY', weight: 0.25 },
                 { ticker: 'JNJ', name: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', asset_class: 'EQUITY', weight: 0.25 },
                 { ticker: 'PG', name: 'Procter & Gamble', country: 'US', sector: 'Consumer Defensive', asset_class: 'EQUITY', weight: 0.20 },
                 { ticker: 'MCD', name: "McDonald's Corp", country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', weight: 0.15 },
                 { ticker: 'HD', name: 'Home Depot', country: 'US', sector: 'Consumer Cyclical', asset_class: 'EQUITY', weight: 0.15 },
            ] as PortfolioAsset[],
            returns: 0.09,
            volatility: 0.14,
            sharpeRatio: 0.46
        },
    },
    {
        id: 1003,
        name: 'All-Weather 60/40',
        description: 'A classic balanced portfolio targeting 60% equities and 40% bonds for steady growth across market cycles.',
        template: PortfolioTemplate.Balanced,
        created_at: new Date('2024-01-20').toISOString(),
        result: {
            weights: [
                { ticker: 'SPY', name: 'SPDR S&P 500 ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', weight: 0.40 },
                { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', weight: 0.20 },
                { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', weight: 0.30 },
                { ticker: 'GLD', name: 'SPDR Gold Shares', country: 'US', sector: 'Mixed', asset_class: 'BENCHMARK', weight: 0.10 },
            ] as PortfolioAsset[],
            returns: 0.11,
            volatility: 0.12,
            sharpeRatio: 0.58
        },
    }
];
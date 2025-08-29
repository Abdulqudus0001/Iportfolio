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

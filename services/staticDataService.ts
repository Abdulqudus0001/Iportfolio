// This file contains a static, pre-fetched cache of data to avoid hitting API rate limits
// during development and for demo purposes.

const generatePriceHistory = (basePrice: number, volatility: number, trend: number, length: number = 252 * 3) => {
    let price = basePrice;
    const history = [];
    for (let i = 0; i < length; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (length - i));
        price *= 1 + (Math.random() - 0.5) * volatility + trend;
        if (price <= 0) price = basePrice * 0.01; // prevent price from going to or below zero
        history.push({
            date: date.toISOString().split('T')[0],
            price: parseFloat(price.toFixed(4))
        });
    }
    return history;
}

const stocks = [
    { symbol: 'AAPL', companyName: 'Apple Inc.', country: 'US', sector: 'Technology', isEsg: true, price: 172.5 },
    { symbol: 'MSFT', companyName: 'Microsoft Corporation', country: 'US', sector: 'Technology', isEsg: true, price: 305.2 },
    { symbol: 'GOOGL', companyName: 'Alphabet Inc.', country: 'US', sector: 'Technology', isEsg: false, price: 136.8 },
    { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', country: 'US', sector: 'Consumer Cyclical', isEsg: false, price: 130.5 },
    { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', country: 'US', sector: 'Financial Services', isEsg: false, price: 142.3 },
    { symbol: 'JNJ', companyName: 'Johnson & Johnson', country: 'US', sector: 'Healthcare', isEsg: true, price: 166.1 },
    { symbol: 'V', companyName: 'Visa Inc.', country: 'US', sector: 'Financial Services', isEsg: true, price: 238.4 },
    { symbol: 'PG', companyName: 'Procter & Gamble Company', country: 'US', sector: 'Consumer Defensive', isEsg: true, price: 151.2 },
    { symbol: 'TSM', companyName: 'Taiwan Semiconductor Manufacturing', country: 'US', sector: 'Technology', isEsg: false, price: 98.6 },
    { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', country: 'US', sector: 'Energy', isEsg: false, price: 112.9 },
    { symbol: 'NEE', companyName: 'NextEra Energy, Inc.', country: 'US', sector: 'Utilities', isEsg: true, price: 71.5 },
    { symbol: 'HD', companyName: 'The Home Depot, Inc.', country: 'US', sector: 'Consumer Cyclical', isEsg: false, price: 335.7 },
    { symbol: 'MCD', companyName: "McDonald's Corporation", country: 'US', sector: 'Consumer Cyclical', isEsg: false, price: 292.1 },
    { symbol: 'SPY', companyName: 'SPDR S&P 500 ETF Trust', country: 'US', sector: 'Mixed', isEsg: false, price: 452.8 },
    { symbol: 'QQQ', companyName: 'Invesco QQQ Trust', country: 'US', sector: 'Mixed', isEsg: false, price: 385.2 },
    { symbol: 'IEFA', companyName: 'iShares Core MSCI EAFE ETF', country: 'US', sector: 'Mixed', isEsg: false, price: 70.1 },
    { symbol: 'AGG', companyName: 'iShares Core U.S. Aggregate Bond ETF', country: 'US', sector: 'Mixed', isEsg: false, price: 98.5 },
    { symbol: 'GLD', companyName: 'SPDR Gold Shares', country: 'US', sector: 'Mixed', isEsg: false, price: 180.2 },
    { symbol: '2222.SR', companyName: 'Saudi Aramco', country: 'SAUDI ARABIA', sector: 'Energy', isEsg: false, price: 35.50 },
    { symbol: 'QNBK.QA', companyName: 'Qatar National Bank', country: 'QATAR', sector: 'Financial Services', isEsg: false, price: 17.20 },
    { symbol: 'DANGCEM.LG', companyName: 'Dangote Cement', country: 'NIGERIA', sector: 'Basic Materials', isEsg: false, price: 280.00 },
    { symbol: 'HSBC.L', companyName: 'HSBC Holdings plc', country: 'UK', sector: 'Financial Services', isEsg: true, price: 6.50 },
    { symbol: 'BATS.L', companyName: 'British American Tobacco p.l.c.', country: 'UK', sector: 'Consumer Defensive', isEsg: false, price: 25.00 },
    { symbol: '1120.SR', companyName: 'Al Rajhi Bank', country: 'SAUDI ARABIA', sector: 'Financial Services', isEsg: false, price: 80.00 },
];
const cryptos = [
    { symbol: 'BTC', name: 'Bitcoin', price: 43500 },
    { symbol: 'ETH', name: 'Ethereum', price: 2300 },
    { symbol: 'SOL', name: 'Solana', price: 65.5 },
    { symbol: 'XRP', name: 'XRP', price: 0.62 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.08 },
    { symbol: 'ADA', name: 'Cardano', price: 0.55 },
    { symbol: 'ALGO', name: 'Algorand', price: 0.18 },
    { symbol: 'BONK', name: 'Bonk', price: 0.000014 },
    { symbol: 'APT', name: 'Aptos', price: 9.50 },
    { symbol: 'ASTR', name: 'Astar', price: 0.10 },
    { symbol: 'COMP', name: 'Compound', price: 58.00 },
    { symbol: 'BAT', name: 'Basic Attention Token', price: 0.25 },
    { symbol: 'CELO', name: 'Celo', price: 0.75 },
    { symbol: 'ARB', name: 'Arbitrum', price: 1.80 },
    { symbol: 'CVX', name: 'Convex Finance', price: 3.50 },
    { symbol: 'MATIC', name: 'Polygon', price: 0.85 },
    { symbol: 'DOT', name: 'Polkadot', price: 6.50 },
    { symbol: 'AVAX', name: 'Avalanche', price: 35.00 },
    { symbol: 'LINK', name: 'Chainlink', price: 14.20 },
    { symbol: 'UNI', name: 'Uniswap', price: 6.10 },
    { symbol: 'LUNA', name: 'Terra', price: 0.60 },
    { symbol: 'AXL', name: 'Axelar', price: 0.88 },
    { symbol: 'DATA', name: 'Streamr', price: 0.05 },
    { symbol: 'GIGA', name: 'Gigachad', price: 0.0000003 },
    { symbol: 'PORTO', name: 'FC Porto Fan Token', price: 2.50 },
    { symbol: 'CELR', name: 'Celer Network', price: 0.02 },
    { symbol: 'ANKR', name: 'Ankr', price: 0.04 },
    { symbol: 'ALPINE', name: 'Alpine F1 Team Fan Token', price: 1.80 },
    { symbol: 'ETHFI', name: 'ether.fi', price: 4.50 },
    { symbol: 'BCH', name: 'Bitcoin Cash', price: 450.00 },
    { symbol: 'JOE', name: 'JOE', price: 0.50 },
    { symbol: 'ENJ', name: 'Enjin Coin', price: 0.35 },
    { symbol: 'LSK', name: 'Lisk', price: 1.50 },
    { symbol: 'GRT', name: 'The Graph', price: 0.30 },
    { symbol: 'SATS', name: 'SATS', price: 0.0000005 },
    { symbol: 'BOME', name: 'BOOK OF MEME', price: 0.012 },
    { symbol: 'BSW', name: 'Biswap', price: 0.08 },
    { symbol: 'BAND', name: 'Band Protocol', price: 1.80 },
    { symbol: 'OGN', name: 'Origin Protocol', price: 0.15 },
    { symbol: 'PHB', name: 'Red Pulse Phoenix', price: 1.20 },
    { symbol: 'NOT', name: 'Notcoin', price: 0.015 },
    { symbol: 'RDNT', name: 'Radiant Capital', price: 0.25 },
    { symbol: 'ADX', name: 'AdEx', price: 0.20 },
    { symbol: 'AAVE', name: 'Aave', price: 90.00 },
    { symbol: 'SC', name: 'Siacoin', price: 0.007 },
    { symbol: 'CFX', name: 'Conflux', price: 0.20 },
];

const allAssets = [...stocks, ...cryptos];

const generateAllData = () => {
    const quotes: Record<string, any> = {};
    const ratios: Record<string, any> = {};
    const priceHistories: Record<string, any> = {};
    const financials: Record<string, any> = {};
    const dividends: Record<string, any> = {};
    const esgScores: Record<string, any> = {};

    stocks.forEach(stock => {
        const price = stock.price;
        quotes[stock.symbol] = {
            open: price * (1 - 0.01 * Math.random()),
            price: price,
            high: price * (1 + 0.01 * Math.random()),
            low: price * (1 - 0.02 * Math.random()),
            volume: 1000000 + Math.random() * 20000000
        };
        ratios[stock.symbol] = {
            priceEarningsRatioTTM: 15 + Math.random() * 20,
            priceToBookRatioTTM: 2 + Math.random() * 8,
            dividendYieldTTM: Math.random() * 0.04
        };
        priceHistories[stock.symbol] = generatePriceHistory(price, 0.02, 0.0003);

        financials[stock.symbol] = {
            income: [{
                date: '2023-12-31',
                revenue: 1000000000 + Math.random() * 50000000000,
                netIncome: 100000000 + Math.random() * 5000000000,
            }],
            balanceSheet: [{
                date: '2023-12-31',
                totalAssets: 2000000000 + Math.random() * 80000000000,
                totalLiabilities: 1000000000 + Math.random() * 40000000000,
            }],
            cashFlow: [{
                date: '2023-12-31',
                operatingCashFlow: 500000000 + Math.random() * 8000000000,
            }]
        };
    
        if (ratios[stock.symbol].dividendYieldTTM > 0.001) {
            dividends[stock.symbol] = {
                historical: [{
                    dividend: (stock.price * ratios[stock.symbol].dividendYieldTTM) / 4,
                    paymentDate: '2023-11-15'
                }]
            };
        }

        if (stock.isEsg) {
            esgScores[stock.symbol] = [{
                ESGScore: 70 + Math.random() * 15,
                environmentalScore: 72 + Math.random() * 15,
                socialScore: 68 + Math.random() * 15,
                governanceScore: 75 + Math.random() * 15,
                ESGRiskRating: 'Low'
            }];
        } else {
            esgScores[stock.symbol] = [{
                ESGScore: 50 + Math.random() * 15,
                environmentalScore: 45 + Math.random() * 15,
                socialScore: 55 + Math.random() * 15,
                governanceScore: 52 + Math.random() * 15,
                ESGRiskRating: 'Medium'
            }];
        }
    });

    cryptos.forEach(crypto => {
        const price = crypto.price;
        quotes[crypto.symbol] = {
            open: price * (1 - 0.02 * Math.random()),
            price: price,
            high: price * (1 + 0.03 * Math.random()),
            low: price * (1 - 0.03 * Math.random()),
            volume: 100000 + Math.random() * 5000000
        };
        priceHistories[crypto.symbol] = generatePriceHistory(price, 0.08, 0.001);
    });

    return { quotes, ratios, priceHistories, financials, dividends, esgScores };
};

const { quotes, ratios, priceHistories, financials, dividends, esgScores } = generateAllData();

export const staticData = {
    stocks,
    cryptos,
    quotes,
    ratios,
    priceHistories,
    financials,
    dividends,
    esgScores,
    news: [
        { title: "Fed Hints at Slower Pace of Rate Hikes", site: "Reuters", text: "Federal Reserve officials have suggested that the central bank may slow its pace of interest rate increases in the coming months, citing signs of cooling inflation." },
        { title: "Tech Stocks Rally on Positive Earnings Reports", site: "Bloomberg", text: "Major technology companies reported stronger-than-expected quarterly earnings, leading to a broad rally in the tech sector and boosting market sentiment." },
        { title: "Oil Prices Fluctuate Amid Geopolitical Tensions", site: "Wall Street Journal", text: "Crude oil prices remain volatile as investors weigh supply concerns stemming from international geopolitical events against fears of a global economic slowdown." }
    ],
    fxRates: {
        'USD': 1.0,
        'EUR': 0.92,
        'GBP': 0.79,
        'JPY': 157.5,
        'INR': 83.5,
        'NGN': 1480,
        'QAR': 3.64,
        'SAR': 3.75,
    }
};
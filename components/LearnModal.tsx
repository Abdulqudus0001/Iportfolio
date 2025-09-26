import React, { useState } from 'react';
import Modal from './ui/Modal';

type LearnCategory = 'Key Concepts' | 'Feature Guides' | 'Investment Strategies';

const learnData = {
  'Key Concepts': [
    {
      term: 'Volatility (Standard Deviation)',
      definition: 'A measure of how much an asset\'s price fluctuates over time. Higher volatility means higher risk, as prices can change dramatically in either direction.',
    },
    {
      term: 'Sharpe Ratio',
      definition: 'A measure of risk-adjusted return. It tells you how much return you are getting for each unit of risk you take. A higher Sharpe Ratio is generally better.',
    },
    {
      term: 'Diversification',
      definition: 'The strategy of investing in a variety of assets to reduce risk. The idea is that if one investment performs poorly, others may perform well, smoothing out your overall returns.',
    },
    {
      term: 'Correlation',
      definition: 'A statistic that measures the degree to which two assets move in relation to each other. A correlation of +1 means they move perfectly together; -1 means they move perfectly opposite. Low correlation is good for diversification.',
    },
    {
      term: 'Efficient Frontier',
      definition: 'A graph representing a set of optimal portfolios that offer the highest expected return for a defined level of risk. The goal of optimization is to find a portfolio on this frontier.',
    },
    {
        term: 'Beta',
        definition: 'A measure of a stock\'s volatility in relation to the overall market (e.g., the S&P 500). A beta of 1 means the stock moves with the market. A beta > 1 is more volatile; < 1 is less volatile.',
    },
    {
        term: 'Market Capitalization (Market Cap)',
        definition: 'The total market value of a company\'s outstanding shares. It\'s calculated by multiplying the stock price by the number of shares. It\'s a common way to measure a company\'s size.',
    },
    {
        term: 'P/E Ratio (Price-to-Earnings)',
        definition: 'A ratio for valuing a company that measures its current share price relative to its per-share earnings. It shows what the market is willing to pay today for a stock based on its past or future earnings.',
    },
    {
      term: 'Factor Investing',
      definition: 'An investment approach that involves targeting specific drivers of return across assets. Common factors include Value (cheap stocks), Size (small companies), and Momentum (stocks trending upwards).',
    },
    {
      term: 'Value at Risk (VaR)',
      definition: 'A risk management statistic that quantifies the extent of possible financial loss within a firm, portfolio, or position over a specific time frame. For example, "a 1-day 95% VaR of $1 million" means there is a 5% chance of losing more than $1 million in a single day.',
    },
  ],
  'Feature Guides': [
    {
      term: 'Portfolio Builder',
      definition: 'This is your main workspace. Use the "Portfolio Mode" dropdown to select pre-built strategy templates or choose "Custom Portfolio" for full control. In Custom Mode, you can search and add assets one-by-one, import a list from a CSV file, and manually set their weights. Use the "Clear All" button to quickly restart your selection. Once your assets are chosen, you can either manually calculate metrics based on your weights or use the "Find Optimal Weights" button to let our engine do the work for you.',
    },
    {
      term: 'Analytics View',
      definition: 'Dive deep into your portfolio here. "Composition" shows your allocation by asset, sector, and country. "Correlation" reveals how your assets move in relation to each other (low correlation is good for diversity). "Factor Analysis" breaks down your portfolio\'s exposure to market drivers.',
    },
    {
      term: 'Backtesting',
      definition: 'Found in the "Analysis Output" section of the Portfolio view, the backtesting tool simulates how your current portfolio would have performed in the past against a benchmark like the S&P 500. It\'s a powerful way to assess your strategy\'s historical viability.',
    },
    {
      term: 'Scenario Analysis',
      definition: 'An Advanced feature in the Analytics view that lets you stress-test your portfolio against historical or hypothetical market events, like a tech crash or an oil price spike, to see the potential impact on your returns.',
    },
    {
        term: 'AI Co-Pilot',
        definition: 'The floating bot icon opens your AI assistant. You can ask it to explain financial concepts, suggest alternative assets if you can\'t find one, or provide a high-level review of your generated portfolio. It can even help you navigate the app.',
    },
  ],
  'Investment Strategies': [
    {
      term: 'Growth Investing',
      definition: 'Focuses on companies that are expected to grow at an above-average rate compared to other companies in the market. These are often tech companies or firms in expanding industries. They typically don\'t pay dividends.',
    },
    {
      term: 'Value Investing',
      definition: 'Involves picking stocks that appear to be trading for less than their intrinsic or book value. Value investors actively seek out stocks they believe the market has undervalued.',
    },
    {
      term: 'Dollar-Cost Averaging (DCA)',
      definition: 'An investment strategy in which an investor divides up the total amount to be invested across periodic purchases of a target asset. The goal is to reduce the impact of volatility on the overall purchase. Purchases occur regardless of the asset\'s price.',
    },
    {
      term: 'The 60/40 Portfolio',
      definition: 'A classic balanced portfolio strategy that allocates 60% of capital to stocks (for growth) and 40% to bonds (for income and stability). It\'s considered a moderate-risk strategy suitable for many long-term investors.',
    },
    {
        term: 'ESG Investing',
        definition: 'Stands for Environmental, Social, and Governance. It is an investment strategy that seeks to consider these three factors alongside financial analysis to identify companies with sustainable business models.',
    },
  ],
};

interface LearnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LearnModal: React.FC<LearnModalProps> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<LearnCategory>('Key Concepts');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Learn Hub" size="xl">
      <div className="flex flex-col md:flex-row -mx-6 -mb-6">
        <div className="w-full md:w-1/4 bg-light-bg dark:bg-dark-bg p-4 rounded-l-lg border-r dark:border-gray-700">
          <h3 className="font-semibold text-lg mb-3">Categories</h3>
          <nav className="space-y-1">
            {Object.keys(learnData).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category as LearnCategory)}
                className={`w-full text-left p-2 rounded-md text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-brand-secondary text-white'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </nav>
        </div>
        <div className="w-full md:w-3/4 p-6">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {learnData[activeCategory].map(({ term, definition }) => (
              <div key={term} className="p-3 bg-light-bg dark:bg-dark-bg rounded-lg border dark:border-gray-700">
                <h4 className="font-semibold text-brand-secondary">{term}</h4>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{definition}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LearnModal;
# iPortfolio - Professional Portfolio Analysis & Optimization

**iPortfolio** is a sophisticated, feature-rich web application designed for modern investors. It provides a comprehensive suite of tools for portfolio construction, in-depth analysis, and advanced optimization across multi-market equities and cryptocurrencies. Powered by the Google Gemini API, it features an AI Co-Pilot to guide users, explain complex financial concepts, and provide intelligent portfolio reviews.

![iPortfolio Screenshot](https://storage.googleapis.com/proud-booth-3333/ipotfolio_dashboard.png)

---

## ✨ Core Features

iPortfolio is packed with features that cater to investors of all experience levels, from beginners to sophisticated analysts.

- **📊 Interactive Dashboard**: A central hub providing a high-level overview of your active portfolio, watchlist, alerts, and key market news.
- **🔍 Asset Browser**: Search, filter, and analyze thousands of global stocks and cryptocurrencies. View detailed price summaries, key financial ratios, historical charts, and manage a personal watchlist.
- **🛠️ Portfolio Construction**:
    - **Manual Mode**: Add assets and define custom weights for full control.
    - **Strategy Templates**: Use pre-built templates like `Balanced`, `Aggressive`, or `ESG` to automatically generate a diversified portfolio.
    - **CSV Import**: Quickly import your holdings from a CSV file.
- **🚀 Advanced Optimization**:
    - **Modern Portfolio Theory (MPT)**: Find the optimal portfolio on the efficient frontier.
    - **Optimization Models**: Choose from models like Maximize Sharpe Ratio, Minimize Volatility, and Risk Parity.
    - **Monte Carlo Simulations**: Visualize thousands of potential portfolio outcomes.
    - **Black-Litterman Model**: (Advanced Tier) Incorporate your personal market views into the optimization process.
- **🔬 In-Depth Analytics (Pro+)**:
    - **Composition Analysis**: Visualize your portfolio's breakdown by asset, sector, and country.
    - **Correlation Matrix**: Understand how your assets move in relation to each other to ensure proper diversification.
    - **Risk & Return Contribution**: See which assets are driving returns and which are contributing the most risk.
    - **Historical Backtesting**: Simulate your portfolio's performance against benchmarks like the S&P 500 (SPY).
- **🧠 AI Co-Pilot (Powered by Google Gemini)**:
    - **Explain Concepts**: Ask for simple explanations of financial terms like "Sharpe Ratio" or "Beta".
    - **AI Portfolio Review**: Get an AI-driven analysis of your portfolio's strengths and weaknesses.
    - **Asset Discovery**: Ask for alternative investment ideas based on your interests.
- ** tiered Experience**:
    - **Basic**: Perfect for new investors with a guided wizard and simplified tools.
    - **Professional**: Unlocks advanced analytics, backtesting, and all portfolio templates.
    - **Advanced**: Accesses institutional-grade tools like Value at Risk (VaR), Scenario Analysis, and advanced optimization models.
- **🔐 User Authentication & Cloud Sync**: Create a free account to save and sync multiple portfolios across devices using Supabase.
- **🌐 Community Portfolios**: Explore and clone pre-built portfolio strategies from the community to kickstart your investment journey.
- **🎨 Theming**: Switch between a clean light mode and a sleek dark mode.

---

## 🛠️ Tech Stack & Architecture

iPortfolio is built with a modern, robust, and scalable tech stack.

- **Frontend**:
    - **Framework**: React with TypeScript
    - **Styling**: Tailwind CSS
    - **Charting**: Recharts
- **Backend & Database (BaaS)**:
    - **Provider**: Supabase
    - **Features**: User Authentication, PostgreSQL Database (for saving portfolios), Edge Functions (for server-side optimization logic).
- **Artificial Intelligence**:
    - **Provider**: Google AI
    - **Model**: Gemini 2.5 Flash via the `@google/genai` SDK.
- **Financial Data Sources**:
    - A resilient **aggregator service** (`marketDataService.ts`) pulls data from multiple redundant APIs to ensure high availability.
    - **Providers**: Financial Modeling Prep, Alpha Vantage, Twelve Data, EOD Historical Data, NewsAPI.
- **State Management**:
    - React Context API for managing global state like user authentication, portfolio data, and theme.

### Architectural Highlights

- **Service Aggregator Pattern**: The `marketDataService.ts` acts as a single point of entry for all financial data. It intelligently queries multiple APIs, implements fallback logic if one provider fails, and uses a caching layer (`cacheService.ts`) to minimize redundant requests and handle API rate limits gracefully.
- **Component-Based UI**: The interface is built with modular, reusable React components located in the `components/` directory.
- **Feature Gating via Context**: User Tiers (`UserTierContext.ts`) are managed globally, allowing components to conditionally render features based on the user's subscription level.

---

## 🚀 Getting Started

Follow these instructions to get a local copy of iPortfolio up and running.

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/iportfolio.git
    cd iportfolio
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    The application requires API keys to function. Create a `.env` file in the root of your project by copying the example:
    ```bash
    cp .env.example .env
    ```
    Now, open the `.env` file and add your API key:
    ```
    # Get your key from Google AI Studio: https://aistudio.google.com/
    API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
    ```
    > **Note**: Other financial data API keys are currently hardcoded in their respective service files for demo purposes (e.g., in `services/financialDataService.ts`). In a production environment, these should also be moved to environment variables.

4.  **Set up Supabase:**
    - Create a new project on [Supabase](https://supabase.com/).
    - In the SQL Editor, create the necessary tables for `portfolios` and `shared_portfolios`. You can use the schema implied by the code in `context/SavedPortfoliosContext.tsx` and `services/portfolioService.ts`.
    - Find your Project URL and anon key in `Project Settings > API` and update the `services/supabaseClient.ts` file.

5.  **Run the development server:**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

---

## 📂 Project Structure

```
/
├── components/         # Reusable React components
│   ├── analytics/      # Components for the Analytics view
│   ├── dashboard/      # Components for the Dashboard view
│   ├── portfolio/      # Components for the Portfolio view
│   └── ui/             # Generic UI elements (Card, Button, Modal)
├── context/            # React Context providers for global state
├── hooks/              # Custom React hooks
├── services/           # API clients and data-fetching logic
├── supabase/           # Supabase edge functions
├── App.tsx             # Main application component and routing
├── types.ts            # Central TypeScript type definitions
├── index.html          # Main HTML file
└── index.tsx           # Application entry point
```

---

## 💡 Future Improvements

- **Real-time Data**: Integrate WebSockets for live price updates.
- **Testing**: Implement a robust testing suite with Jest and React Testing Library.
- **Advanced Transaction Tracking**: Build a full transaction ledger with cost basis and P/L tracking.
- **Enhanced Visualizations**: Add more interactive charts and heatmaps for data analysis.
- **CI/CD Pipeline**: Set up automated workflows for testing and deployment.

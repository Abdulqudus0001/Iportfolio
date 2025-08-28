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
    - All external API calls are securely handled by the `api-proxy` Supabase Edge Function.
- **State Management**:
    - React Context API for managing global state like user authentication, portfolio data, and theme.

### Architectural Highlights

- **Secure API Gateway**: The `api-proxy` Edge Function acts as a secure backend, managing all API keys and handling calls to financial data providers and the Google Gemini API. This keeps all secrets off the client-side.
- **Component-Based UI**: The interface is built with modular, reusable React components located in the `components/` directory.
- **Feature Gating via Context**: User Tiers (`UserTierContext.ts`) are managed globally, allowing components to conditionally render features based on the user's subscription level.

---

## 🚀 Getting Started with Supabase CLI

Follow these instructions to deploy the application and its backend functions using the Supabase CLI.

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed on your machine.
- A Supabase account and a new project created.

### Deployment Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/iportfolio.git
    cd iportfolio
    ```

2.  **Log in to the Supabase CLI:**
    This command will open a browser window for you to authorize your account.
    ```bash
    supabase login
    ```

3.  **Set Up Secrets in Supabase Dashboard:**
    Before deploying, you must add your secret API keys to your Supabase project.
    - Go to your project's dashboard on `supabase.com`.
    - Navigate to **Project Settings > Edge Functions**.
    - Add a new secret for each of the following:
        - `FMP_API_KEY`: Your key from Financial Modeling Prep.
        - `NEWS_API_KEY`: Your key from NewsAPI.
        - `GEMINI_API_KEY`: Your key from Google AI Studio.

4.  **Link Your Local Project to Supabase:**
    Replace `YOUR_PROJECT_REF` with the Reference ID found in your Supabase project's settings (Settings > General).
    ```bash
    supabase link --project-ref YOUR_PROJECT_REF
    ```
    You will be prompted to enter your database password.

5.  **Deploy the Edge Function:**
    This command bundles and deploys the `api-proxy` function, which handles all backend logic.
    ```bash
    supabase functions deploy api-proxy --no-verify-jwt
    ```

6.  **Done!**
    Your application's backend is now live. You can open the `index.html` file or serve the static files to use the app.

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
│   └── functions/
│       └── api-proxy/  # The main backend Edge Function
├── App.tsx             # Main application component and routing
├── types.ts            # Central TypeScript type definitions
├── index.html          # Main HTML file
└── index.tsx           # Application entry point
```

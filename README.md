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
    - **Strategy Templates**: Use pre-built templates like `Balanced`, `Aggressive`, or `Shariah Compliant` to automatically generate a diversified portfolio.
    - **CSV Import**: Quickly import your holdings from a CSV file.
- **🚀 Advanced Optimization**:
    - **Modern Portfolio Theory (MPT)**: Implements MPT to find the optimal portfolio on the efficient frontier.
    - **Optimization Models**: Choose from fully functional models like Maximize Sharpe Ratio, Minimize Volatility, and Risk Parity.
    - **Monte Carlo Simulations**: Runs thousands of simulations to map the efficient frontier and visualize potential outcomes.
    - **Black-Litterman Model**: (Advanced Tier) Incorporate your personal market views into the optimization process.
- **🔬 In-Depth Analytics (Pro+)**:
    - **Composition Analysis**: Visualize your portfolio's breakdown by asset, sector, and country.
    - **Correlation Matrix**: Understand how your assets move in relation to each other to ensure proper diversification.
    - **Risk & Return Contribution**: See which assets are driving returns and which are contributing the most risk.
    - **Value at Risk (VaR)**: (Advanced Tier) Calculates potential 1-day loss at 95% confidence using historical simulation.
    - **Market Scenario Analysis**: (Advanced Tier) Stress-tests the portfolio against major economic events.
- **🧠 AI Co-Pilot (Powered by Google Gemini)**:
    - **Explain Concepts**: Ask for simple explanations of financial terms like "Sharpe Ratio" or "Beta".
    - **AI Portfolio Review**: Get an AI-driven analysis of your portfolio's strengths and weaknesses.
    - **Asset Discovery**: Ask for alternative investment ideas based on your interests.
- ** tiered Experience**:
    - **Basic**: Perfect for new investors with a guided wizard and simplified tools.
    - **Professional**: Unlocks advanced analytics, backtesting, and all portfolio templates.
    - **Advanced**: Accesses institutional-grade tools like VaR, Scenario Analysis, and advanced optimization models.
- **🔐 User Authentication & Cloud Sync**: Create a free account to save and sync multiple portfolios across devices using Supabase.
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
    - **Features**: User Authentication, PostgreSQL Database (for saving portfolios), Edge Functions.
- **Artificial Intelligence**:
    - **Provider**: Google AI
    - **Model**: Gemini 2.5 Flash via the `@google/genai` SDK.
- **Financial Data Sources**:
    - All external API calls are securely handled by the `api-proxy` Supabase Edge Function.

### Architectural Highlights

- **Secure API Gateway**: The `api-proxy` Edge Function acts as a secure backend, managing all API keys and handling calls to financial data providers and the Google Gemini API. This keeps all secrets off the client-side.
- **Server-Side Caching**: Leverages a PostgreSQL table (`api_cache`) within Supabase to provide a centralized, server-side cache for all external API calls. This drastically improves performance, reduces costs, and enhances application resiliency.
- **Scheduled Cron Job**: A `template-screener-cron` Edge Function runs on a daily schedule to perform intensive screening for template portfolios, caching the results for fast access.
- **Component-Based UI**: The interface is built with modular, reusable React components.
- **Feature Gating via Context**: User Tiers (`UserTierContext.ts`) are managed globally, allowing components to conditionally render features based on the user's selected experience level.

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

3.  **Link Your Local Project to Supabase:**
    Replace `YOUR_PROJECT_REF` with the Reference ID found in your Supabase project's settings (Settings > General).
    ```bash
    supabase link --project-ref YOUR_PROJECT_REF
    ```
    You will be prompted to enter your database password.

4.  **Set Up Secrets in Supabase:**
    Before deploying, you must add your secret API keys to your Supabase project using the CLI. **Do not put keys in your code.**
    
    ```bash
    supabase secrets set FMP_API_KEY="your_financial_modeling_prep_key"
    supabase secrets set ALPHA_VANTAGE_API_KEY="your_alpha_vantage_key"
    supabase secrets set NEWS_API_KEY="your_newsapi_key"
    supabase secrets set GEMINI_API_KEY="your_google_gemini_key"
    ```

5.  **Create the Cache Table:**
    This is a critical step. Log in to your Supabase project dashboard, navigate to the **SQL Editor**, and run the following command to create the necessary table for caching API responses:
    ```sql
    CREATE TABLE public.api_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      last_fetched TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    ```

6.  **Deploy the Edge Functions:**
    This command bundles and deploys the `api-proxy` and `template-screener-cron` functions. We use a simplified `config.toml` for this initial deployment.
    ```bash
    supabase functions deploy
    ```

7.  **Set the Cron Job Schedule:**
    After the functions are deployed, update the cron job to run on its daily schedule using this command:
    ```bash
    supabase functions update template-screener-cron --schedule "0 8 * * *"
    ```

8.  **Done!**
    Your application's backend is now live. You can open the `index.html` file or serve the static files to use the app.

---

## 📂 Project Structure

```
/
├── components/         # Reusable React components
│   ├── analytics/      # Components for the Analytics view
│   ├── dashboard/      # Components for the Dashboard view
│   └── ui/             # Generic UI elements (Card, Button, Modal)
├── context/            # React Context providers for global state
├── hooks/              # Custom React hooks
├── services/           # API clients and data-fetching logic
├── supabase/           # Supabase edge functions
│   └── functions/
│       ├── _shared/
│       ├── api-proxy/  # The main backend Edge Function
│       └── template-screener-cron/ # The scheduled cron job
├── App.tsx             # Main application component and routing
├── types.ts            # Central TypeScript type definitions
├── config.toml         # Supabase local configuration
├── index.html          # Main HTML file
└── index.tsx           # Application entry point
```
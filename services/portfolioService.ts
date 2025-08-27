import { Asset, OptimizationResult, MCMCResult, PortfolioAsset, PortfolioTemplate, PriceDataPoint, CorrelationData, ContributionData, ConstraintOptions, BacktestResult, Scenario, ScenarioResult, FactorExposures, VaRResult, TaxLossHarvestingResult, OptimizationModel, BlackLittermanView, SavedPortfolio, Currency } from '../types';
import { marketDataService, ServiceResponse } from './marketDataService';
import { COMMUNITY_PORTFOLIOS } from '../constants';
import { supabase } from './supabaseClient';
import { getCurrencySymbol } from '../utils';

type DataSource = 'live' | 'cache' | 'static';

const mean = (arr: number[]): number => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

export const portfolioService = {
  
  async generateAndOptimizePortfolio(template: PortfolioTemplate, optimizationModel: OptimizationModel, runner: 'mcmc' | 'optimize', currency: Currency, constraints: ConstraintOptions = {}): Promise<MCMCResult & { source: DataSource }> {
    try {
        const allAssets = await marketDataService.getAvailableAssets();
        let pool = allAssets.filter(a => a.asset_class !== 'BENCHMARK' && a.price);

        if (template === PortfolioTemplate.Aggressive) pool = pool.filter(a => ['Technology', 'Consumer Cyclical'].includes(a.sector) || a.asset_class === 'CRYPTO');
        if (template === PortfolioTemplate.ESG) pool = pool.filter(a => a.is_esg);
        if (template === PortfolioTemplate.Shariah) pool = pool.filter(a => a.is_shariah_compliant);
        
        // Select a diverse pool of up to 15 assets for optimization
        const assets = pool.sort(() => .5 - Math.random()).slice(0, 15);
        
        const riskFreeRate = await marketDataService.getRiskFreeRate();

        const { data, error } = await supabase.functions.invoke('secure-api-gateway', {
            body: {
                action: 'optimize-portfolio',
                payload: { assets, runner, constraints, riskFreeRate }
            },
        });

        if (error) {
            // Check if the error is a string and try to parse it as JSON, which the edge function returns
            let errorMessage = error.message;
            try {
                const parsedError = JSON.parse(error.message);
                if (parsedError.error) {
                    errorMessage = parsedError.error;
                }
            } catch (e) {
                // Not a JSON error, use original message
            }
             throw new Error(errorMessage);
        }

        return data;

    } catch (error) {
        console.error("Error invoking portfolio optimization function:", error.message || error);
        throw error;
    }
  },
  
  async runBlackLittermanOptimization(assets: Asset[], views: BlackLittermanView[], currency: Currency): Promise<MCMCResult & { source: DataSource }> {
    console.log("Running Mock Black-Litterman with views:", views);
    const mcmcResult = await this.generateAndOptimizePortfolio(PortfolioTemplate.Balanced, OptimizationModel.MaximizeSharpe, 'mcmc', currency);
    
    const tiltedWeights = [...mcmcResult.bestSharpe.weights];
    views.forEach(view => {
        const index1 = tiltedWeights.findIndex(a => a.ticker === view.asset_ticker_1);
        const index2 = tiltedWeights.findIndex(a => a.ticker === view.asset_ticker_2);
        
        if (index1 !== -1 && index2 !== -1) {
            const tiltAmount = 0.05 * view.confidence;
            if (view.direction === 'outperform') {
                tiltedWeights[index1].weight += tiltAmount;
                tiltedWeights[index2].weight -= tiltAmount;
            } else {
                tiltedWeights[index1].weight -= tiltAmount;
                tiltedWeights[index2].weight += tiltAmount;
            }
        }
    });
    const totalWeight = tiltedWeights.reduce((sum, w) => sum + w.weight, 0);
    const normalizedWeights = tiltedWeights.map(w => ({...w, weight: Math.max(0, w.weight / totalWeight)}));
    const finalPortfolio: OptimizationResult = {
        ...mcmcResult.bestSharpe,
        weights: normalizedWeights,
        returns: mcmcResult.bestSharpe.returns * 1.05,
        sharpeRatio: mcmcResult.bestSharpe.sharpeRatio * 1.1,
        currency: currency,
    };
    return { ...mcmcResult, bestSharpe: finalPortfolio };
  },

  async getCorrelationMatrix(assets: Asset[], currency: Currency): Promise<CorrelationData & { source: DataSource }> {
      if (assets.length < 2) return { assets: [], matrix: [], source: 'live' };
      const priceHistoriesResults = await Promise.all(
          assets.map(a => marketDataService.getAssetPriceHistory(a.ticker, '1y'))
      );
      
      let overallSource: DataSource = 'live';
      const validReturns: number[][] = [];
      const validTickers: string[] = [];

      priceHistoriesResults.forEach((res, i) => {
          if (res.data && res.data.length > 1) {
              const logReturns = res.data.slice(1).map((p, j) => Math.log(p.price / res.data[j].price)).filter(val => isFinite(val));
              validReturns.push(logReturns);
              validTickers.push(assets[i].ticker);
              if (res.source === 'static') overallSource = 'static';
              else if (res.source === 'cache' && overallSource === 'live') overallSource = 'cache';
          }
      });
      
      if(validReturns.length < 2) return { assets: validTickers, matrix: [], source: overallSource };
      
      const minLength = Math.min(...validReturns.map(r => r.length));
      const alignedReturns = validReturns.map(r => r.slice(r.length - minLength));
      
      const matrix = Array(alignedReturns.length).fill(0).map(() => Array(alignedReturns.length).fill(0));
      for (let i = 0; i < alignedReturns.length; i++) {
          matrix[i][i] = 1;
          for (let j = i + 1; j < alignedReturns.length; j++) {
              const mean1 = mean(alignedReturns[i]);
              const mean2 = mean(alignedReturns[j]);
              const std1 = Math.sqrt(mean(alignedReturns[i].map(x => (x-mean1)**2)));
              const std2 = Math.sqrt(mean(alignedReturns[j].map(x => (x-mean2)**2)));
              if (std1 === 0 || std2 === 0) {
                  matrix[i][j] = matrix[j][i] = 0;
                  continue;
              }
              const cov = mean(alignedReturns[i].map((x, k) => (x - mean1) * (alignedReturns[j][k] - mean2)));
              matrix[i][j] = matrix[j][i] = cov / (std1 * std2);
          }
      }
      
      return { assets: validTickers, matrix, source: overallSource };
  },

  async getRiskReturnContribution(portfolio: OptimizationResult): Promise<ContributionData[]> {
      const assets = portfolio.weights;
      if (assets.length === 0) return [];
      const totalReturn = portfolio.returns;
      return assets.map(asset => ({
          ticker: asset.ticker,
          returnContribution: (asset.weight * totalReturn) / totalReturn, // Simplified for demo
          riskContribution: asset.weight, // Simplified for demo
      }));
  },
  
  async calculatePortfolioMetricsFromCustomWeights(assets: Asset[], weights: Record<string, number>, currency: Currency): Promise<OptimizationResult & { source: DataSource }> {
      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
      if (Math.abs(totalWeight - 100) > 1) throw new Error("Weights must sum to 100.");

      const portfolioAssets = assets.map(a => ({...a, weight: (weights[a.ticker] || 0)/100}));

      const histories = await Promise.all(assets.map(a => marketDataService.getAssetPriceHistory(a.ticker, '1y')));
      const overallSource: DataSource = histories.some(r => r.source === 'static') ? 'static' : (histories.some(r => r.source === 'cache') ? 'cache' : 'live');

      // Simplified metric calculation
      return {
          weights: portfolioAssets,
          returns: 0.10 + Math.random() * 0.1,
          volatility: 0.15 + Math.random() * 0.1,
          sharpeRatio: 0.8 + Math.random() * 0.5,
          currency: currency,
          source: overallSource,
      };
  },

  async runBacktest(portfolio: OptimizationResult, timeframe: '1y' | '3y' | '5y', benchmarkTicker: string): Promise<BacktestResult> {
      const fxRate = await marketDataService.getFxRate('USD', portfolio.currency || 'USD');
      const tickers = portfolio.weights.map(a => a.ticker);
      const allTickers = [...new Set([benchmarkTicker, ...tickers])];
      const priceHistories = await Promise.all(allTickers.map(t => marketDataService.getAssetPriceHistory(t, timeframe).then(res => res.data)));
      const initialInvestment = 10000;
      
      const portfolioValues = [initialInvestment];
      const benchmarkValues = [initialInvestment];
      const dates = priceHistories[0].map(p => p.date);
      let peak = initialInvestment;
      let maxDrawdown = 0;

      for (let i = 1; i < dates.length; i++) {
        let portfolioDayValue = 0;
        portfolio.weights.forEach((asset, idx) => {
            const assetHistory = priceHistories[allTickers.indexOf(asset.ticker)];
            if (assetHistory?.[i] && assetHistory?.[0]) {
                const initialPrice = assetHistory[0].price * fxRate;
                const currentPrice = assetHistory[i].price * fxRate;
                if(initialPrice > 0) {
                    portfolioDayValue += (initialInvestment * asset.weight / initialPrice) * currentPrice;
                }
            }
        });
        if(portfolioDayValue === 0) portfolioDayValue = portfolioValues[portfolioValues.length - 1];
        portfolioValues.push(portfolioDayValue);
        
        if (portfolioDayValue > peak) peak = portfolioDayValue;
        const drawdown = (peak - portfolioDayValue) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        const benchmarkHistory = priceHistories[allTickers.indexOf(benchmarkTicker)];
        if (benchmarkHistory?.[i] && benchmarkHistory?.[0]) {
            const initialPrice = benchmarkHistory[0].price * fxRate;
            const currentPrice = benchmarkHistory[i].price * fxRate;
            if(initialPrice > 0) {
                benchmarkValues.push(initialInvestment / initialPrice * currentPrice);
            } else {
                benchmarkValues.push(benchmarkValues[benchmarkValues.length-1]);
            }
        } else {
             benchmarkValues.push(benchmarkValues[benchmarkValues.length-1]);
        }
      }
      return {
        dates, portfolioValues, benchmarkValues,
        totalReturn: (portfolioValues[portfolioValues.length - 1] - initialInvestment) / initialInvestment,
        benchmarkReturn: (benchmarkValues[benchmarkValues.length - 1] - initialInvestment) / initialInvestment,
        maxDrawdown,
      };
  },

  async runScenarioAnalysis(portfolio: OptimizationResult, scenario: Scenario): Promise<ScenarioResult> {
      let scenarioAdjustedReturn = 0;
      portfolio.weights.forEach(asset => {
          const impactMultiplier = scenario.impact[asset.sector] || 1.0;
          scenarioAdjustedReturn += asset.weight * portfolio.returns * impactMultiplier;
      });
      return {
          originalReturn: portfolio.returns,
          scenarioReturn: scenarioAdjustedReturn,
          impactPercentage: (scenarioAdjustedReturn - portfolio.returns) / Math.abs(portfolio.returns)
      };
  },

  async runFactorAnalysis(portfolio: OptimizationResult): Promise<FactorExposures> {
      return { beta: 1.05 + (Math.random() - 0.5) * 0.3, smb: (Math.random() - 0.5) * 0.4, hml: (Math.random() - 0.5) * 0.4 };
  },

  async calculateVaR(portfolio: OptimizationResult): Promise<VaRResult> {
      const portfolioValue = 10000;
      const dailyVolatility = portfolio.volatility / Math.sqrt(252);
      return { 
          var95: portfolioValue * dailyVolatility * 1.645, 
          cvar95: portfolioValue * dailyVolatility * 2.063, 
          portfolioValue
      };
  },

  async simulateTaxLossHarvesting(portfolio: OptimizationResult): Promise<TaxLossHarvestingResult> {
      const candidates = portfolio.weights.slice(0, 2).map(a => ({ ticker: a.ticker, unrealizedLoss: Math.random() * 500, currentValue: a.weight * 10000 }));
      return { candidates, potentialTaxSavings: candidates.reduce((s, c) => s + c.unrealizedLoss, 0) * 0.15 };
  },
  
  async generateRebalancePlan(currentPortfolio: OptimizationResult, targetWeights: PortfolioAsset[]): Promise<{ ticker: string; action: 'BUY' | 'SELL'; amount: string }[]> {
    const plan: { ticker: string; action: 'BUY' | 'SELL'; amount: string }[] = [];
    const totalValue = 10000;
    const currencySymbol = getCurrencySymbol(currentPortfolio.currency);

    const currentMap = new Map(currentPortfolio.weights.map(a => [a.ticker, a.weight]));

    for (const targetAsset of targetWeights) {
        const currentWeight = currentMap.get(targetAsset.ticker) || 0;
        const weightDiff = targetAsset.weight - currentWeight;

        if (Math.abs(weightDiff) > 0.005) { // 0.5% threshold
            const action = weightDiff > 0 ? 'BUY' : 'SELL';
            const amount = Math.abs(weightDiff) * totalValue;
            plan.push({ ticker: targetAsset.ticker, action, amount: `${currencySymbol}${amount.toFixed(2)}` });
        }
    }
    return plan;
  },

  async sharePortfolio(portfolio: SavedPortfolio): Promise<string> {
    const { data, error } = await supabase
      .from('shared_portfolios')
      .insert({ portfolio_data: portfolio })
      .select('id')
      .single();
    if (error) throw new Error('Could not share portfolio.');
    return data.id;
  },

  async getSharedPortfolio(id: string): Promise<SavedPortfolio | null> {
    const { data, error } = await supabase
      .from('shared_portfolios')
      .select('portfolio_data')
      .eq('id', id)
      .single();
    if (error) return null;
    return data.portfolio_data;
  }
};
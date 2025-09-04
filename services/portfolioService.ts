import { Asset, OptimizationResult, MCMCResult, PortfolioAsset, PortfolioTemplate, PriceDataPoint, CorrelationData, ContributionData, ConstraintOptions, BacktestResult, Scenario, ScenarioResult, FactorExposures, VaRResult, TaxLossHarvestingResult, OptimizationModel, BlackLittermanView, SavedPortfolio, Currency, DataSource } from '../types';
import { supabase } from './supabaseClient';
import { ServiceResponse } from './marketDataService';

async function invokeApiProxy<T>(command: string, payload?: object): Promise<T> {
    const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: { command, payload: payload || {} },
    });
    if (error) {
        console.error(`Error invoking api-proxy for command "${command}":`, error);
        throw error;
    }
     if (data.error) {
        throw new Error(data.error);
    }
    return data;
}

export const portfolioService = {
  
  generateAndOptimizePortfolio(template: PortfolioTemplate, optimizationModel: OptimizationModel, runner: 'mcmc' | 'optimize', currency: Currency, constraints: ConstraintOptions = {}): Promise<MCMCResult> {
    return invokeApiProxy('generateAndOptimizePortfolio', { template, optimizationModel, runner, currency, constraints });
  },
  
  runBlackLittermanOptimization(assets: Asset[], views: BlackLittermanView[], currency: Currency): Promise<MCMCResult> {
    return invokeApiProxy('runBlackLittermanOptimization', { assets, views, currency });
  },

  getCorrelationMatrix(assets: Asset[], currency: Currency): Promise<ServiceResponse<CorrelationData>> {
      return invokeApiProxy('getCorrelationMatrix', { assets, currency });
  },

  getRiskReturnContribution(portfolio: OptimizationResult): Promise<ContributionData[]> {
      return invokeApiProxy('getRiskReturnContribution', { portfolio });
  },
  
  calculatePortfolioMetricsFromCustomWeights(assets: Asset[], weights: Record<string, number>, currency: Currency): Promise<ServiceResponse<OptimizationResult>> {
      return invokeApiProxy('calculatePortfolioMetricsFromCustomWeights', { assets, weights, currency });
  },

  runBacktest(portfolio: OptimizationResult, timeframe: '1y' | '3y' | '5y', benchmarkTicker: string): Promise<BacktestResult> {
      return invokeApiProxy('runBacktest', { portfolio, timeframe, benchmarkTicker });
  },

  runScenarioAnalysis(portfolio: OptimizationResult, scenario: Scenario): Promise<ScenarioResult> {
      return invokeApiProxy('runScenarioAnalysis', { portfolio, scenario });
  },

  runFactorAnalysis(portfolio: OptimizationResult): Promise<FactorExposures> {
      return invokeApiProxy('runFactorAnalysis', { portfolio });
  },

  calculateVaR(portfolio: OptimizationResult): Promise<VaRResult> {
      return invokeApiProxy('calculateVaR', { portfolio });
  },

  simulateTaxLossHarvesting(portfolio: OptimizationResult): Promise<TaxLossHarvestingResult> {
      return invokeApiProxy('simulateTaxLossHarvesting', { portfolio });
  },
  
  async generateRebalancePlan(currentPortfolio: OptimizationResult, targetWeights: PortfolioAsset[]): Promise<{ ticker: string; action: 'BUY' | 'SELL'; amount: string }[]> {
    return invokeApiProxy('generateRebalancePlan', { currentPortfolio, targetWeights });
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
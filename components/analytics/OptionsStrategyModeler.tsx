import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { OptimizationResult, OptionContract } from '../../types';
import { marketDataService } from '../../services/marketDataService';
import Modal from '../ui/Modal';
import Loader from '../ui/Loader';
import Button from '../ui/Button';

interface OptionsStrategyModelerProps {
  portfolio: OptimizationResult;
  onClose: () => void;
}

const OptionsStrategyModeler: React.FC<OptionsStrategyModelerProps> = ({ portfolio, onClose }) => {
  const equityAssets = useMemo(() => portfolio.weights.filter(a => a.asset_class === 'EQUITY'), [portfolio]);
  const [selectedAsset, setSelectedAsset] = useState<string>(equityAssets[0]?.ticker || '');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [optionChain, setOptionChain] = useState<OptionContract[]>([]);
  const [selectedStrike, setSelectedStrike] = useState<number>(0);
  const [premium, setPremium] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [plData, setPlData] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedAsset) return;
    setIsLoading(true);
    // For simplicity, we fetch options expiring roughly a month out.
    const today = new Date();
    today.setDate(today.getDate() + 30);
    const expirationDate = today.toISOString().split('T')[0];

    Promise.all([
      marketDataService.getOptionChain(selectedAsset, expirationDate),
      marketDataService.getAssetPriceSummary(selectedAsset)
    ]).then(([chainResponse, summary]) => {
      const chainData = chainResponse.data || [];
      setOptionChain(chainData.filter(c => c.type === 'call'));
      setCurrentPrice(summary.data.close);
      // Select a strike price slightly out of the money
      const targetStrike = summary.data.close * 1.05;
      const closestOption = chainData.reduce((prev, curr) => 
          Math.abs(curr.strikePrice - targetStrike) < Math.abs(prev.strikePrice - targetStrike) ? curr : prev, { strikePrice: Infinity } as OptionContract
      );
      setSelectedStrike(closestOption.strikePrice);
      setPremium(closestOption.lastPrice);
      setIsLoading(false);
    }).catch(err => {
        console.error(err);
        setIsLoading(false);
    });
  }, [selectedAsset]);

  useEffect(() => {
    if (currentPrice > 0 && selectedStrike > 0 && premium > 0) {
      const data = [];
      const range = 0.2; // Show +/- 20% from current price
      const startPrice = currentPrice * (1 - range);
      const endPrice = currentPrice * (1 + range);
      const steps = 50;
      
      for (let i = 0; i <= steps; i++) {
        const stockPrice = startPrice + (endPrice - startPrice) * (i / steps);
        // P/L for a covered call: gain/loss on stock + premium - loss on call if exercised
        const stockPl = stockPrice - currentPrice;
        const callPl = Math.max(0, stockPrice - selectedStrike);
        const totalPl = stockPl + premium - callPl;
        data.push({ stockPrice, pl: totalPl });
      }
      setPlData(data);
    }
  }, [currentPrice, selectedStrike, premium]);


  return (
    <Modal isOpen={true} onClose={onClose} title="Options Strategy: Covered Call" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Asset</label>
            <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className="w-full mt-1 p-2 border rounded">
              {equityAssets.map(a => <option key={a.ticker} value={a.ticker}>{a.ticker}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Strike Price</label>
             <select value={selectedStrike} onChange={e => {
                 const strike = Number(e.target.value);
                 setSelectedStrike(strike);
                 setPremium(optionChain.find(c => c.strikePrice === strike)?.lastPrice || 0);
             }} className="w-full mt-1 p-2 border rounded" disabled={isLoading}>
                 {optionChain.map(c => <option key={c.strikePrice} value={c.strikePrice}>{c.strikePrice}</option>)}
             </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Premium (Credit)</label>
            <input type="number" value={premium} onChange={e => setPremium(Number(e.target.value))} className="w-full mt-1 p-2 border rounded" />
          </div>
        </div>
        
        {isLoading ? <Loader message="Fetching option chain..." /> : (
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <LineChart data={plData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stockPrice" name="Stock Price at Expiry" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tick => `$${tick.toFixed(0)}`} />
                <YAxis dataKey="pl" name="Profit/Loss" tickFormatter={tick => `$${tick.toFixed(2)}`} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                <ReferenceLine x={selectedStrike} stroke="red" strokeDasharray="3 3" label={{ value: 'Strike', position: 'insideTopRight' }} />
                <Line type="monotone" dataKey="pl" stroke="#8884d8" strokeWidth={2} dot={false} name="P/L per Share" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OptionsStrategyModeler;
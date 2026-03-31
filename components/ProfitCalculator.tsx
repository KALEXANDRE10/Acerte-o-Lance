
import React from 'react';
import { CalculationParams, CalculatedResults } from '../types';

interface ProfitCalculatorProps {
  fipeValue: number;
  params: CalculationParams;
  onChange: (params: CalculationParams) => void;
}

const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ fipeValue, params, onChange }) => {
  const calculateResults = (): CalculatedResults => {
    const resaleValue = fipeValue * (1 - params.resaleDiscountPercentage / 100);
    const marginMultiplier = (100 - params.targetProfitMargin) / 100;
    
    const maxBid = (resaleValue * marginMultiplier - params.fixedCosts) / (1 + params.auctionFeePercentage / 100);
    const totalInvestment = maxBid * (1 + params.auctionFeePercentage / 100) + params.fixedCosts;
    const projectedProfit = resaleValue - totalInvestment;

    return {
      maxBid: Math.max(0, maxBid),
      projectedProfit,
      totalInvestment,
      resaleValue
    };
  };

  const results = calculateResults();

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-50 shadow-sm">
      <h3 className="text-[10px] font-black mb-6 text-brand-gold flex items-center gap-3 uppercase tracking-[0.3em]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        Simulador de Margem
      </h3>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-8">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Margem Alvo (%)</label>
          <input 
            type="number" 
            value={params.targetProfitMargin}
            onChange={(e) => onChange({ ...params, targetProfitMargin: Number(e.target.value) })}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-gold/30 outline-none font-bold text-brand-navy"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Desconto Revenda (% FIPE)</label>
          <div className="relative">
            <input 
              type="number" 
              value={params.resaleDiscountPercentage}
              onChange={(e) => onChange({ ...params, resaleDiscountPercentage: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-gold/30 outline-none font-bold text-brand-navy"
            />
            <span className="absolute right-4 top-4 text-xs text-slate-300 font-black">%</span>
          </div>
        </div>
        
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Custos Extras (R$)</label>
          <input 
            type="number" 
            value={params.fixedCosts}
            onChange={(e) => onChange({ ...params, fixedCosts: Number(e.target.value) })}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-gold/30 outline-none font-bold text-brand-navy"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Taxa Leiloeiro (%)</label>
          <input 
            type="number" 
            value={params.auctionFeePercentage}
            onChange={(e) => onChange({ ...params, auctionFeePercentage: Number(e.target.value) })}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand-gold/30 outline-none font-bold text-brand-navy"
          />
        </div>
      </div>

      <div className="bg-brand-navy rounded-[2rem] p-8 space-y-6 shadow-2xl shadow-brand-navy/20">
        <div className="flex flex-col items-center text-center">
          <span className="text-brand-gold text-[10px] font-black uppercase tracking-[0.4em] mb-3">Lance Máximo Sugerido</span>
          <span className="text-3xl font-black text-white">R$ {results.maxBid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        
        <div className="h-px bg-white/10"></div>
        
        <div className="grid grid-cols-2 gap-6">
           <div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Revenda Est.</p>
              <p className="font-bold text-white text-base">R$ {results.resaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
           </div>
           <div className="text-right">
              <p className="text-[9px] text-brand-gold font-black uppercase tracking-widest mb-1">Lucro Líquido</p>
              <p className="font-black text-white text-base">R$ {results.projectedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculator;

import React from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { FullReturnGoDashboardData } from '../types';

interface ReturnsKpiCardProps {
  label: string;
  value: string | number;
  help_text?: string;
  trend?: number | null;
  card_accent?: string;
  value_color?: string;
  rmaCount?: number;
  rmaListKey?: keyof FullReturnGoDashboardData['rmaLists'];
  onClick?: (label: string, rmaListKey: keyof FullReturnGoDashboardData['rmaLists']) => void;
}

export const ReturnsKpiCard: React.FC<ReturnsKpiCardProps> = ({
  label,
  value,
  help_text = "",
  trend = null,
  card_accent = "#3a8dff",
  value_color = "#7bd6ff",
  rmaCount,
  rmaListKey,
  onClick
}) => {
  return (
    <div 
      className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-[160px] w-full mb-6 relative overflow-hidden group ${rmaListKey ? 'cursor-pointer' : ''}`} 
      title={help_text}
      onClick={() => rmaListKey && onClick && onClick(label, rmaListKey)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500" style={{ backgroundColor: card_accent }}></div>
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</div>
          <div className="text-4xl font-black tracking-tighter" style={{ color: value_color }}>{value}</div>
          {rmaCount !== undefined && (
            <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
              {rmaCount} RMAs
            </div>
          )}
        </div>
        
        {trend !== null && (
          <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : trend < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { parseISO, isValid } from 'date-fns';
import { ReturnGoRMA, FullReturnGoDashboardData } from '../types';

interface ReturnsMetricCardProps {
  label: string;
  count_key: string;
  counts: Record<string, number>;
  help_text?: string;
  card_accent?: string;
  count_color?: string;
  rmaListKey?: keyof FullReturnGoDashboardData['rmaLists'];
  displayRmaLists?: FullReturnGoDashboardData['rmaLists'];
  onClick?: (label: string, rmaListKey: keyof FullReturnGoDashboardData['rmaLists']) => void;
  onSparklineClick?: (title: string, rmas: ReturnGoRMA[]) => void;
}

export const ReturnsMetricCard: React.FC<ReturnsMetricCardProps> = ({
  label,
  count_key,
  counts,
  help_text = "",
  card_accent = "#3a8dff",
  count_color = "#7bd6ff",
  rmaListKey,
  displayRmaLists,
  onClick,
  onSparklineClick
}) => {
  const count = counts[count_key] || 0;
  
  let sparklineContent = null;
  
  if (rmaListKey && displayRmaLists && displayRmaLists[rmaListKey]) {
    const rmas = displayRmaLists[rmaListKey] || [];
    if (rmas.length > 0) {
      const ageGroups: Record<number, ReturnGoRMA[]> = {};
      let maxAge = 0;
      
      rmas.forEach(rma => {
        const dateStr = rma.lastUpdated || rma.updatedAt || rma.rma_updated_at || rma.createdAt || rma.rma_created_at;
        let age = 0;
        if (dateStr) {
          const parsed = parseISO(dateStr);
          if (isValid(parsed)) {
            age = Math.max(0, Math.floor((new Date().getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
        if (age > 30) age = 30; // Cap at 30 days for visualization
        if (age > maxAge) maxAge = age;
        if (!ageGroups[age]) ageGroups[age] = [];
        ageGroups[age].push(rma);
      });
      
      // Ensure at least 7 days are shown for visual balance
      const displayDays = Math.max(7, maxAge + 1);
      const histogramData = Array.from({ length: displayDays }, (_, i) => ({
        day: i,
        rmas: ageGroups[i] || []
      }));
      
      const maxCount = Math.max(...histogramData.map(d => d.rmas.length), 1);
      
      sparklineContent = (
        <div className="flex flex-col items-end h-full justify-end w-1/2">
          <div className="flex items-end h-16 gap-1 w-full justify-end">
            {histogramData.map((data, i) => (
              <div 
                key={i} 
                className="w-3 rounded-t-sm relative group/bar cursor-pointer transition-all hover:opacity-100" 
                style={{ 
                  height: `${Math.max((data.rmas.length / maxCount) * 100, 5)}%`, 
                  backgroundColor: data.rmas.length > 0 ? card_accent : '#f1f5f9',
                  opacity: data.rmas.length > 0 ? 0.6 : 1
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.rmas.length > 0 && onSparklineClick) {
                    onSparklineClick(`${label} - ${data.day}${data.day === 30 ? '+' : ''} Days Old`, data.rmas);
                  }
                }}
              >
                {data.rmas.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 pointer-events-none whitespace-nowrap z-20">
                    {data.rmas.length} RMAs<br/>{data.day}{data.day === 30 ? '+' : ''} days
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between w-full text-[9px] text-slate-400 font-bold mt-1 px-1">
            <span>0d</span>
            <span>{displayDays - 1}{displayDays - 1 === 30 ? '+' : ''}d</span>
          </div>
          <div className="text-[8px] text-slate-400 uppercase tracking-widest text-right w-full mt-0.5">Days since update</div>
        </div>
      );
    }
  }
  
  return (
    <div 
      className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between h-[180px] w-full mb-6 relative overflow-hidden group" 
      title={help_text}
      onClick={() => rmaListKey && onClick && onClick(label, rmaListKey)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500" style={{ backgroundColor: card_accent }}></div>
      
      <div className="flex justify-between items-start relative z-10 h-full">
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</div>
            <div className="text-5xl font-black tracking-tighter" style={{ color: count_color }}>{count}</div>
          </div>
        </div>
        
        {sparklineContent}
      </div>
      
      {rmaListKey && (
        <div className="absolute bottom-4 right-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          View All <ChevronRight size={12} />
        </div>
      )}
    </div>
  );
};

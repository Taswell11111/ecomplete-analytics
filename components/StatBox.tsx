
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type StatBoxProps = {
  label: string;
  value: string | number;
  trend24h?: number | null;
  trend7d?: number | null;
  onClick: () => void;
  chartData?: number[]; // Array of values for the graph
}

export const StatBox: React.FC<StatBoxProps> = ({ label, value, trend24h, trend7d, onClick, chartData }) => {
  
  // Helper to generate SVG path for area chart
  const renderSparkline = (data: number[]) => {
    if (!data || data.length === 0) return null;

    const height = 40;
    const width = 200;
    const max = Math.max(...data, 1);
    const min = 0;
    
    // Calculate points
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    });

    // Area path (closes loop at bottom)
    const areaPath = `M0,${height} L${points.join(' L')} L${width},${height} Z`;
    // Line path (stroke only)
    const linePath = `M${points.join(' L')}`;

    return (
      <div className="w-full mt-auto relative">
        <div className="h-12 w-full opacity-20 group-hover:opacity-100 transition-all duration-700">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#2C3E50', stopOpacity: 0.4 }} />
                        <stop offset="100%" style={{ stopColor: '#2C3E50', stopOpacity: 0 }} />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#grad-${label.replace(/\s/g, '')})`} className="transition-all duration-700" />
                <path d={linePath} fill="none" stroke="#2C3E50" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="group-hover:stroke-ecomplete-primary transition-all duration-700" />
            </svg>
        </div>
        <div className="flex justify-between w-full px-4 pb-3 mt-2">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">00:00</span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">23:00</span>
        </div>
      </div>
    );
  };

  const renderTrend = (trend: number | undefined | null, label: string) => {
      if (trend === undefined || trend === null) return null;
      return (
        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {Math.abs(trend)} {label}
        </div>
      );
  };

  return (
    <div onClick={onClick} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] hover:border-ecomplete-primary/20 transition-all duration-500 cursor-pointer flex flex-col items-center justify-between text-center group h-full min-h-[200px] relative overflow-hidden">
      
      {/* Decorative Top Accent */}
      <div className="absolute top-0 w-1/2 h-1.5 bg-ecomplete-primary rounded-b-full opacity-0 group-hover:opacity-100 transition-all duration-500 shadow-[0_0_15px_rgba(44,62,80,0.3)]"></div>

      <div className="flex flex-col items-center justify-center flex-1 w-full z-10 p-8 pb-4">
        <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4 group-hover:text-ecomplete-primary transition-colors duration-500">{label}</div>
        <div className="text-5xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tighter group-hover:scale-105 transition-transform duration-500">{value}</div>
        
        {/* Dual Trend Line */}
        {(trend24h !== undefined || trend7d !== undefined) && (
          <div className="flex gap-4 items-center justify-center w-full px-4 bg-slate-50 group-hover:bg-white border border-slate-100 group-hover:border-slate-200 py-2 rounded-2xl mx-auto transition-all duration-500 shadow-sm">
              {renderTrend(trend24h, "24h")}
              {trend24h !== undefined && trend7d !== undefined && <div className="h-3 w-px bg-slate-200"></div>}
              {renderTrend(trend7d, "7d")}
          </div>
        )}
      </div>
      
      {/* Mini Chart Area */}
      {chartData && renderSparkline(chartData)}
    </div>
  );
};

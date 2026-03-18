import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Download, RefreshCw, Settings, X, PieChart, BarChart3, Activity, ShieldCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Types
export type RmaStatus = 'Pending' | 'Approved' | 'Received' | 'Submitted to Courier' | 'In Transit' | 'Done';

export interface Rma {
  id: string;
  store: string;
  status: string;
  order: string;
  customerName: string;
  trackingNumber: string;
  requestedDate: string;
  updatedAt?: string;
  lastUpdated?: string;
}

interface ConsolidatedViewProps {
  allRmas?: Rma[];
  metrics?: any;
  onSync?: () => void;
}

const STORES = ['Diesel', 'Hurley', 'Jeep Apparel', 'Reebok', 'Superdry'];
const TRACKED_STATUSES = ['Pending', 'Approved', 'Received', 'Submitted to Courier', 'In Transit', 'Done'];

export const ConsolidatedView: React.FC<ConsolidatedViewProps> = ({ allRmas = [], metrics, onSync }) => {
  const [filterScope, setFilterScope] = useState<{ status: string | null; store: string | null }>({ status: null, store: null });
  const [selectedRmaId, setSelectedRmaId] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | 'all'>('7d');

  const toggleCard = () => {
    setAllExpanded(!allExpanded);
  };

  const handleFilterClick = (status: string, store: string | null) => {
    if (filterScope.status === status && filterScope.store === store) {
      setFilterScope({ status: null, store: null });
    } else {
      setFilterScope({ status, store });
    }
    setSelectedRmaId(null);
  };

  // 2. Store Sync Status Table data
  const storeSyncData = useMemo(() => {
    return STORES.map(store => {
      const storeRmas = allRmas.filter(rma => rma.store === store);
      const pending = storeRmas.filter(rma => rma.status === 'Pending').length;
      const approved = storeRmas.filter(rma => rma.status === 'Approved').length;
      const received = storeRmas.filter(rma => rma.status === 'Received').length;
      return {
        store,
        lastSynced: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), // Mock timestamp
        pending,
        approved,
        received,
        totalOpen: pending + approved + received
      };
    });
  }, [allRmas]);

  // 3. KPI Blocks data
  const kpiData = useMemo(() => {
    return TRACKED_STATUSES.map(status => {
      const statusRmas = allRmas.filter(rma => rma.status === status);
      const total = statusRmas.length;
      const breakdown = STORES.map(store => ({
        store,
        count: statusRmas.filter(rma => rma.store === store).length
      }));
      return { status, total, breakdown };
    });
  }, [allRmas]);

  // 4. Filtered Data Table
  const filteredRmas = useMemo(() => {
    const filtered = allRmas.filter(rma => {
      if (filterScope.status && rma.status !== filterScope.status) return false;
      if (filterScope.store && rma.store !== filterScope.store) return false;
      return true;
    });
    
    // Sort by requestedDate ascending
    return filtered.sort((a, b) => {
      if (a.requestedDate === 'Unknown') return 1;
      if (b.requestedDate === 'Unknown') return -1;
      const dateA = new Date(a.requestedDate).getTime();
      const dateB = new Date(b.requestedDate).getTime();
      return dateA - dateB;
    });
  }, [allRmas, filterScope]);

  const selectedRma = useMemo(() => allRmas.find(r => r.id === selectedRmaId), [allRmas, selectedRmaId]);

  // 5. Daily Activity Log
  const dailyActivity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activity = allRmas.filter(rma => {
      const dateStr = rma.updatedAt || rma.lastUpdated || rma.requestedDate;
      if (!dateStr || dateStr === 'Unknown') return false;
      const rmaDate = new Date(dateStr);
      return rmaDate >= today;
    });
    
    // Sort by most recent first
    return activity.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.lastUpdated || a.requestedDate || 0).getTime();
      const dateB = new Date(b.updatedAt || b.lastUpdated || b.requestedDate || 0).getTime();
      return dateB - dateA;
    });
  }, [allRmas]);

  // 6. Chart Data Preparation
  const chartData = useMemo(() => {
    if (!metrics?.dailyTrend) return null;

    let allDates = Array.from(new Set([
      ...(metrics.dailyTrend || []).map((d: any) => d.date),
      ...(metrics.completedTrend || []).map((d: any) => d.date),
      ...(metrics.approvedTrend || []).map((d: any) => d.date)
    ])).sort((a, b) => new Date(`${a} 2024`).getTime() - new Date(`${b} 2024`).getTime());

    if (chartTimeframe === '7d') {
      allDates = allDates.slice(-7);
    } else if (chartTimeframe === '30d') {
      allDates = allDates.slice(-30);
    }

    return {
      labels: allDates,
      datasets: [
        {
          label: 'Returns Requested',
          data: allDates.map(date => {
            const found = metrics.dailyTrend?.find((d: any) => d.date === date);
            return found ? found.count : 0;
          }),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Processed Resolutions',
          data: allDates.map(date => {
            const found = metrics.completedTrend?.find((d: any) => d.date === date);
            return found ? found.count : 0;
          }),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Returns Approved',
          data: allDates.map(date => {
            const found = metrics.approvedTrend?.find((d: any) => d.date === date);
            return found ? found.count : 0;
          }),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    };
  }, [metrics, chartTimeframe]);

  return (
    <div className="flex flex-col gap-8 text-slate-800">
      {/* 1. Header & Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="text-3xl">🏢</span> Consolidated RMA Primary Statuses
          </h1>
          <p className="text-sm text-slate-500 mt-2 font-bold uppercase tracking-widest">Multi-brand returns intelligence overview</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onSync && onSync()}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings size={16} /> Sync All Updates
          </button>
        </div>
      </div>

      {/* Daily Activity Log */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Daily Activity Log</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Today's return activities across all brands</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
            {dailyActivity.length} Activities Today
          </div>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {dailyActivity.length > 0 ? (
            dailyActivity.map((activity, idx) => (
              <div key={`${activity.id}-${idx}`} className="flex-shrink-0 w-64 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-slate-700">{activity.store}</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                    activity.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                    activity.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                    activity.status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
                    activity.status === 'In Transit' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {activity.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-800">{activity.order}</div>
                <div className="text-xs text-slate-500">{activity.customerName}</div>
                <div className="text-[10px] text-slate-400 font-medium mt-auto pt-2 border-t border-slate-200">
                  {format(new Date(activity.updatedAt || activity.lastUpdated || activity.requestedDate || new Date()), 'HH:mm a')}
                </div>
              </div>
            ))
          ) : (
            <div className="w-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
              No activity recorded for today yet.
            </div>
          )}
        </div>
      </div>

      {/* 2. Store Sync Status Table */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <span className="text-xl">🏢</span> Store Sync Status
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-slate-200">Store</th>
                <th className="px-6 py-4 border-b border-slate-200">Last Synced</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right">Pending</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right">Approved</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right">Received</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right font-bold text-slate-700">Total Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storeSyncData.map((row, idx) => (
                <tr key={row.store} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{row.store}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{row.lastSynced}</td>
                  <td className="px-6 py-4 text-right text-orange-600 font-medium">{row.pending}</td>
                  <td className="px-6 py-4 text-right text-blue-600 font-medium">{row.approved}</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">{row.received}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-800">{row.totalOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Interactive KPI / Status Blocks */}
      <div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 mb-6 px-2">
          <span className="text-xl">📦</span> Consolidated Status Blocks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kpiData.map((kpi) => (
            <div key={kpi.status} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl transition-all">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{kpi.status}</h3>
                <span className="text-4xl font-black text-slate-800 tracking-tighter">{kpi.total}</span>
              </div>
              
              <div className="bg-white flex-1">
                <button 
                  onClick={toggleCard}
                  className="w-full px-8 py-4 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Per store breakdown
                  {allExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                
                {allExpanded && (
                  <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                      <div 
                        onClick={() => handleFilterClick(kpi.status, null)}
                        className={`flex justify-between items-center px-5 py-3 text-xs cursor-pointer border-b border-slate-200 transition-colors uppercase tracking-wider
                          ${filterScope.status === kpi.status && filterScope.store === null 
                            ? 'bg-blue-100 text-blue-800 font-black' 
                            : 'hover:bg-slate-100 text-slate-600 font-bold'}`}
                      >
                        <span>All Stores</span>
                        <span className="bg-white shadow-sm text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-black">{kpi.total}</span>
                      </div>
                      {kpi.breakdown.map(b => (
                        <div 
                          key={b.store}
                          onClick={() => handleFilterClick(kpi.status, b.store)}
                          className={`flex justify-between items-center px-5 py-2.5 text-xs cursor-pointer border-b last:border-0 border-slate-100 transition-colors uppercase tracking-wider
                            ${filterScope.status === kpi.status && filterScope.store === b.store 
                              ? 'bg-blue-50 text-blue-700 font-black' 
                              : 'hover:bg-slate-100 text-slate-500 font-bold'}`}
                        >
                          <span>{b.store}</span>
                          <span className="text-slate-400 font-black text-[10px]">{b.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3b. Consolidated Distribution Charts */}
      <div className="grid grid-cols-1 gap-8">
        {/* Trend Charts Row */}
        <div className="grid grid-cols-1 gap-8">
          {/* Returns Intelligence Combined Trend */}
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Returns Intelligence</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Requested, Processed, and Approved RMAs</p>
              </div>
            </div>
            <div className="h-[300px]">
              {chartData && chartData.labels.length > 0 ? (
                <Line 
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' }, color: '#64748b' } } },
                    scales: {
                      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } }
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest text-xs">No trend data available</div>
              )}
            </div>
            {/* Filter Bar */}
            <div className="mt-6 flex justify-center gap-2">
              <button 
                onClick={() => setChartTimeframe('7d')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === '7d' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                7 Days
              </button>
              <button 
                onClick={() => setChartTimeframe('30d')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === '30d' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                30 Days
              </button>
              <button 
                onClick={() => setChartTimeframe('all')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${chartTimeframe === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>

        {/* Return Reasons & Resolutions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Return Reason Distribution */}
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                <PieChart size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Return Reason Distribution</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Across all 5 brands</p>
              </div>
            </div>
            <div className="h-[300px] flex items-center justify-center">
              {metrics?.returnReasons && Object.keys(metrics.returnReasons).length > 0 ? (
                <Doughnut 
                  data={{
                    labels: Object.keys(metrics.returnReasons),
                    datasets: [{
                      data: Object.values(metrics.returnReasons),
                      backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' } } }
                    },
                    cutout: '70%'
                  }}
                />
              ) : (
                <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">No data available</div>
              )}
            </div>
          </div>

          {/* Processed Resolutions Distribution */}
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Processed Resolutions Distribution</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Across all 5 brands</p>
              </div>
            </div>
            <div className="h-[300px] flex items-center justify-center">
              {metrics?.resolutionTypes && Object.keys(metrics.resolutionTypes).length > 0 ? (
                <Doughnut 
                  data={{
                    labels: Object.keys(metrics.resolutionTypes),
                    datasets: [{
                      data: Object.values(metrics.resolutionTypes),
                      backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10, weight: 'bold' } } }
                    },
                    cutout: '70%'
                  }}
                />
              ) : (
                <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">No data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Policy Rules Full Width */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Requested Policy Rules Distribution</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Across all 5 brands</p>
            </div>
          </div>
          <div className="h-[400px]">
            {metrics?.policyRules && Object.keys(metrics.policyRules).length > 0 ? (
              <Bar 
                data={{
                  labels: Object.keys(metrics.policyRules),
                  datasets: [{
                    label: 'Policy Rules Triggered',
                    data: Object.values(metrics.policyRules),
                    backgroundColor: '#6366f1',
                    borderRadius: 12,
                    barThickness: 40
                  }]
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                    y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest text-xs">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Consolidated Main Data Table */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <span className="text-xl">📋</span> Consolidated Data Table
          </h2>
          <button className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
            <Download size={14} /> Download CSV
          </button>
        </div>

        {filterScope.status && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Filtered view: <span className="font-bold">{filterScope.status}</span> • <span className="font-bold">{filterScope.store || 'All Stores'}</span>
            </div>
            <button 
              onClick={() => setFilterScope({ status: null, store: null })}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-bold bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
            >
              <X size={14} /> Clear Filter
            </button>
          </div>
        )}

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 border-b border-slate-200">Store</th>
                <th className="px-6 py-4 border-b border-slate-200">RMA ID</th>
                <th className="px-6 py-4 border-b border-slate-200">Order</th>
                <th className="px-6 py-4 border-b border-slate-200">Customer Name</th>
                <th className="px-6 py-4 border-b border-slate-200">Current Status</th>
                <th className="px-6 py-4 border-b border-slate-200">Tracking Number</th>
                <th className="px-6 py-4 border-b border-slate-200">Requested Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRmas.length > 0 ? (
                filteredRmas.map(rma => (
                  <tr 
                    key={rma.id} 
                    onClick={() => setSelectedRmaId(rma.id)}
                    className={`cursor-pointer transition-colors ${selectedRmaId === rma.id ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-6 py-3.5 font-bold text-slate-700">{rma.store}</td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{rma.id}</td>
                    <td className="px-6 py-3.5 text-slate-600">{rma.order}</td>
                    <td className="px-6 py-3.5 text-slate-700 font-medium">{rma.customerName}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                        {rma.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{rma.trackingNumber || '-'}</td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {rma.requestedDate !== 'Unknown' 
                        ? format(parseISO(rma.requestedDate), 'MMM d, yyyy') 
                        : 'Unknown'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No RMAs found matching the current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Row-Level Action Panel */}
      {selectedRma && (
        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Selected: RMA {selectedRma.id}</h3>
              <p className="text-slate-400 text-sm font-medium">from {selectedRma.store} • {selectedRma.customerName}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setSelectedRmaId(null)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-sm transition-colors"
            >
              Deselect
            </button>
            <button 
              onClick={() => onSync && onSync()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
            >
              <RefreshCw size={16} /> Refresh this RMA
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

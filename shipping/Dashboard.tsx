import React, { useState, useMemo } from 'react';
import { useShipments } from '../hooks/useShipments';
import { useInbounds } from '../hooks/useInbounds';
import { OutboundKpis, InboundKpis } from './KpiCards';
import { OutboundStatusChart, OutboundVolumeChart, InboundStatusChart } from './Charts';
import { ShipmentsTable } from './ShipmentsTable';
import { STORES } from '../server/parcelninja';
import { InboundsTable } from './InboundsTable';
import { ReturnsPanel } from './ReturnsPanel';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const ShippingDashboard: React.FC<{ appContext: 'levis' | 'bounty' | 'admin' }> = ({ appContext }) => {
  const [days, setDays] = useState(7); // Default to Last 7 Days (7)
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>('All Stores');
  const { data: outboundsData, isLoading: outLoading, error: outError, refetch: refetchOut } = useShipments(days);
  const { data: inboundsData, isLoading: inLoading, error: inError, refetch: refetchIn } = useInbounds(days);

  const handleRefresh = () => {
    refetchOut();
    refetchIn();
  };

  const filterByContext = (data: any[]) => {
    if (!data) return [];
    if (appContext === 'levis') return data.filter(d => d._store === "Levi's");
    if (appContext === 'bounty') return data.filter(d => d._store !== "Levi's");
    return data;
  };

  const outboundsRaw = useMemo(() => {
    let data = filterByContext(outboundsData?.data || []);
    if (selectedStore !== 'All Stores') {
      data = data.filter(d => d._store === selectedStore);
    }
    return data;
  }, [outboundsData, appContext, selectedStore]);

  const inbounds = useMemo(() => {
    let data = filterByContext(inboundsData?.data || []);
    if (selectedStore !== 'All Stores') {
      data = data.filter(d => d._store === selectedStore);
    }
    return data;
  }, [inboundsData, appContext, selectedStore]);

  const availableStores = useMemo(() => {
    const stores = new Set<string>();
    const allData = [...(outboundsData?.data || []), ...(inboundsData?.data || [])];
    filterByContext(allData).forEach(d => {
      if (d._store) stores.add(d._store);
    });
    return Array.from(stores).sort();
  }, [outboundsData, inboundsData, appContext]);

  const outbounds = useMemo(() => {
    if (!showOnlyPending) return outboundsRaw;
    return outboundsRaw.filter(d => {
      const status = (d.status?.description || '').toLowerCase();
      return !status.includes('delivered') && !status.includes('cancelled');
    });
  }, [outboundsRaw, showOnlyPending]);

  const errors = useMemo(() => {
    const allErrors = { ...(outboundsData?.errors || {}), ...(inboundsData?.errors || {}) };
    const filtered: Record<string, string | null> = {};
    Object.entries(allErrors).forEach(([store, err]) => {
      const errorMsg = err as string | null;
      if (appContext === 'levis' && store === "Levi's") filtered[store] = errorMsg;
      if (appContext === 'bounty' && store !== "Levi's") filtered[store] = errorMsg;
      if (appContext === 'admin') filtered[store] = errorMsg;
    });
    return filtered;
  }, [outboundsData?.errors, inboundsData?.errors, appContext]);

  const hasErrors = Object.values(errors).some(e => e !== null);

  if (outLoading || inLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
        <p className="text-slate-500 font-medium">Loading Shipping Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Shipping Intelligence</h2>
          <p className="text-sm text-slate-500">
            {appContext === 'admin' ? 'All Hubs' : appContext === 'levis' ? "Levi's Hub" : 'Bounty Brands Hub'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedStore} 
            onChange={e => setSelectedStore(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All Stores">All Stores</option>
            {availableStores.map(store => (
              <option key={store} value={store}>{store}</option>
            ))}
          </select>
          <select 
            value={days} 
            onChange={e => setDays(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>Today (GMT+2)</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <input 
              type="checkbox" 
              id="pending-only" 
              checked={showOnlyPending} 
              onChange={e => setShowOnlyPending(e.target.checked)}
              className="rounded text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="pending-only" className="text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer">
              Pending Only
            </label>
          </div>
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {hasErrors && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider mb-1">Connection Issues Detected</h4>
            <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
              {Object.entries(errors).filter(([_, err]) => err !== null).map(([store, err]) => (
                <li key={store}><span className="font-bold">{store}:</span> {err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Data Sources Status</h4>
        <div className="flex flex-wrap gap-3">
          {STORES.filter(s => {
            if (appContext === 'levis') return s.name === "Levi's";
            if (appContext === 'bounty') return s.name !== "Levi's";
            return true;
          }).map(store => {
            const hasData = [...outboundsRaw, ...inbounds].some(d => d._store === store.name);
            const hasError = errors[store.name];
            return (
              <div 
                key={store.name} 
                title={hasError ? String(hasError) : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
                  hasError ? 'bg-red-50 border-red-200 text-red-600 cursor-help' : 
                  hasData ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                  'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${
                  hasError ? 'bg-red-500 animate-pulse' : 
                  hasData ? 'bg-emerald-500' : 
                  'bg-slate-300'
                }`} />
                {store.name}
                {hasError && <span className="ml-1 opacity-70">(! Error)</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">Outbounds / Shipments</h3>
        <OutboundKpis data={outbounds} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OutboundStatusChart data={outbounds} />
          <OutboundVolumeChart data={outbounds} />
        </div>
        <ShipmentsTable data={outbounds} />
      </div>

      <div className="space-y-6 pt-8 border-t border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">Inbounds / Stock Arrivals</h3>
        <InboundKpis data={inbounds} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InboundStatusChart data={inbounds} />
          {/* Variance Table placeholder */}
        </div>
        <InboundsTable data={inbounds} />
      </div>

      <ReturnsPanel appContext={appContext} />
    </div>
  );
};

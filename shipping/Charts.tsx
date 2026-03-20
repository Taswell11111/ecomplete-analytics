import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#f97316', '#64748b', '#8b5cf6', '#ec4899'];

const CHART_HEIGHT = 300;

const EmptyChart: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
    <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
    <div style={{ width: '100%', height: CHART_HEIGHT }} className="flex items-center justify-center">
      <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">No data available</p>
    </div>
  </div>
);

export const OutboundStatusChart: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChart title="Shipments by Status per Store" />;

  const storeMap = new Map();
  
  data.forEach(d => {
    const store = d._store;
    const status = d.status?.description || 'Unknown';
    if (!storeMap.has(store)) {
      storeMap.set(store, { name: store, Delivered: 0, Dispatched: 0, Processing: 0, Cancelled: 0, Returned: 0, Unknown: 0 });
    }
    const storeData = storeMap.get(store);
    
    if (status.toLowerCase().includes('delivered')) storeData.Delivered++;
    else if (status.toLowerCase().includes('dispatched') || status.toLowerCase().includes('collected')) storeData.Dispatched++;
    else if (status.toLowerCase().includes('processing')) storeData.Processing++;
    else if (status.toLowerCase().includes('cancelled')) storeData.Cancelled++;
    else if (status.toLowerCase().includes('returned')) storeData.Returned++;
    else storeData.Unknown++;
  });

  const chartData = Array.from(storeMap.values());

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipments by Status per Store</h3>
      <div style={{ width: '100%', height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Delivered" stackId="a" fill="#10b981" isAnimationActive={false} />
            <Bar dataKey="Dispatched" stackId="a" fill="#3b82f6" isAnimationActive={false} />
            <Bar dataKey="Processing" stackId="a" fill="#f59e0b" isAnimationActive={false} />
            <Bar dataKey="Cancelled" stackId="a" fill="#ef4444" isAnimationActive={false} />
            <Bar dataKey="Returned" stackId="a" fill="#8b5cf6" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const OutboundVolumeChart: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChart title="Shipment Volume (Last 24h)" />;

  const hourlyMap = new Map();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Initialize all 24 hours
  for (let i = 0; i < 24; i++) {
    const hour = new Date(twentyFourHoursAgo.getTime() + i * 60 * 60 * 1000);
    const hourKey = hour.getHours() + ':00';
    hourlyMap.set(hourKey, { hour: hourKey, count: 0 });
  }
  
  data.forEach(d => {
    if (!d.createDate) return;
    try {
      const createDate = new Date(d.createDate);
      if (createDate >= twentyFourHoursAgo && createDate <= now) {
        const hourKey = createDate.getHours() + ':00';
        if (hourlyMap.has(hourKey)) {
          hourlyMap.get(hourKey).count++;
        }
      }
    } catch (e) { /* ignore */ }
  });

  const chartData = Array.from(hourlyMap.values());

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipment Volume (Last 24h)</h3>
      <div style={{ width: '100%', height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const InboundStatusChart: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChart title="Inbounds by Status per Store" />;

  const storeMap = new Map();
  
  data.forEach(d => {
    const store = d._store;
    const status = d.status?.description || 'Unknown';
    if (!storeMap.has(store)) {
      storeMap.set(store, { name: store, Awaiting: 0, Arrived: 0, Processing: 0, Available: 0, Variance: 0, Unknown: 0 });
    }
    const storeData = storeMap.get(store);
    
    if (d.status?.code === 200) storeData.Awaiting++;
    else if (d.status?.code === 201) storeData.Arrived++;
    else if (d.status?.code === 202) storeData.Processing++;
    else if (d.status?.code === 203) storeData.Available++;
    else if (d.status?.code === 204) storeData.Variance++;
    else storeData.Unknown++;
  });

  const chartData = Array.from(storeMap.values());

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Inbounds by Status per Store</h3>
      <div style={{ width: '100%', height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Awaiting" stackId="a" fill="#64748b" isAnimationActive={false} />
            <Bar dataKey="Arrived" stackId="a" fill="#6366f1" isAnimationActive={false} />
            <Bar dataKey="Processing" stackId="a" fill="#f59e0b" isAnimationActive={false} />
            <Bar dataKey="Available" stackId="a" fill="#10b981" isAnimationActive={false} />
            <Bar dataKey="Variance" stackId="a" fill="#f59e0b" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#f97316', '#64748b', '#8b5cf6', '#ec4899'];

export const OutboundStatusChart: React.FC<{ data: any[] }> = ({ data }) => {
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
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipments by Status per Store</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Delivered" stackId="a" fill="#10b981" />
            <Bar dataKey="Dispatched" stackId="a" fill="#3b82f6" />
            <Bar dataKey="Processing" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Cancelled" stackId="a" fill="#ef4444" />
            <Bar dataKey="Returned" stackId="a" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const OutboundVolumeChart: React.FC<{ data: any[] }> = ({ data }) => {
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
    const createDate = new Date(d.createDate);
    if (createDate >= twentyFourHoursAgo && createDate <= now) {
      const hourKey = createDate.getHours() + ':00';
      if (hourlyMap.has(hourKey)) {
        hourlyMap.get(hourKey).count++;
      }
    }
  });

  const chartData = Array.from(hourlyMap.values());

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipment Volume (Last 24h)</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const InboundStatusChart: React.FC<{ data: any[] }> = ({ data }) => {
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
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Inbounds by Status per Store</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} />
            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Awaiting" stackId="a" fill="#64748b" />
            <Bar dataKey="Arrived" stackId="a" fill="#6366f1" />
            <Bar dataKey="Processing" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Available" stackId="a" fill="#10b981" />
            <Bar dataKey="Variance" stackId="a" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

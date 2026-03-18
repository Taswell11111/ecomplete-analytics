import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#f97316', '#64748b'];

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
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Shipments by Status per Store</h3>
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
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
          <Bar dataKey="Returned" stackId="a" fill="#f97316" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const OutboundVolumeChart: React.FC<{ data: any[] }> = ({ data }) => {
  const dateMap = new Map();
  
  data.forEach(d => {
    if (!d.createDate) return;
    const date = d.createDate.split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, count: 0 });
    }
    dateMap.get(date).count++;
  });

  const chartData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Shipment Volume</h3>
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{fontSize: 12}} />
          <YAxis tick={{fontSize: 12}} />
          <Tooltip wrapperStyle={{ fontSize: '12px' }} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
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
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Inbounds by Status per Store</h3>
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
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
  );
};

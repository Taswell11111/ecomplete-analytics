import React from 'react';

type KpiCardProps = {
  title: string;
  value: string | number;
  colorClass?: string;
};

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, colorClass = 'text-slate-900' }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
};

export const OutboundKpis: React.FC<{ data: any[] }> = ({ data }) => {
  const total = data.length;
  const delivered = data.filter(d => d.status?.description?.toLowerCase().includes('delivered')).length;
  const dispatched = data.filter(d => {
    const s = d.status?.description?.toLowerCase() || '';
    return s.includes('dispatched') || s.includes('collected');
  }).length;
  const processing = data.filter(d => d.status?.description?.toLowerCase().includes('processing')).length;
  const cancelled = data.filter(d => d.status?.description?.toLowerCase().includes('cancelled')).length;
  const returned = data.filter(d => d.status?.description?.toLowerCase().includes('returned')).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <KpiCard title="Total Shipments" value={total} />
      <KpiCard title="Delivered" value={delivered} colorClass="text-emerald-600" />
      <KpiCard title="Dispatched" value={dispatched} colorClass="text-blue-600" />
      <KpiCard title="Processing" value={processing} colorClass="text-yellow-600" />
      <KpiCard title="Cancelled" value={cancelled} colorClass="text-red-600" />
      <KpiCard title="Returned" value={returned} colorClass="text-orange-600" />
    </div>
  );
};

export const InboundKpis: React.FC<{ data: any[] }> = ({ data }) => {
  const total = data.length;
  const awaiting = data.filter(d => d.status?.code === 200).length;
  const arrived = data.filter(d => d.status?.code === 201).length;
  const processing = data.filter(d => d.status?.code === 202).length;
  const complete = data.filter(d => d.status?.code === 203).length;
  const variance = data.filter(d => d.status?.code === 204).length;
  
  const varianceRecords = data.filter(d => {
    return d.items?.some((item: any) => item.qty !== item.receivedQty && item.receivedQty !== 0);
  }).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      <KpiCard title="Total Inbounds" value={total} />
      <KpiCard title="Awaiting" value={awaiting} colorClass="text-slate-600" />
      <KpiCard title="Arrived" value={arrived} colorClass="text-indigo-600" />
      <KpiCard title="Processing" value={processing} colorClass="text-yellow-600" />
      <KpiCard title="Available" value={complete} colorClass="text-emerald-600" />
      <KpiCard title="Variance Status" value={variance} colorClass="text-amber-600" />
      <KpiCard title="Variance Items" value={varianceRecords} colorClass="text-red-600" />
    </div>
  );
};

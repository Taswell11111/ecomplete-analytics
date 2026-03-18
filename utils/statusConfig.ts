export const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s.includes('dispatched') || s.includes('collected')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s.includes('processing')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (s.includes('cancelled')) return 'bg-red-100 text-red-800 border-red-200';
  if (s.includes('returned')) return 'bg-orange-100 text-orange-800 border-orange-200';
  
  // Inbound statuses
  if (s.includes('awaiting arrival')) return 'bg-slate-100 text-slate-800 border-slate-200';
  if (s.includes('arrived at warehouse')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (s.includes('being processed')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (s.includes('processing complete')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s.includes('complete with variance')) return 'bg-amber-100 text-amber-800 border-amber-200';

  return 'bg-gray-100 text-gray-800 border-gray-200';
};

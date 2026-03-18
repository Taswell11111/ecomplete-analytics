
import { CATEGORIES, CATEGORY_COLORS } from '../constants';

export const getCategoryColor = (category: string) => {
  const idx = CATEGORIES.indexOf(category as any);
  return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : '#94a3b8';
};

export const getUrgencyColor = (urgency: string) => {
  switch (urgency.toUpperCase()) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#eab308';
    case 'LOW': return '#22c55e';
    default: return '#94a3b8';
  }
};

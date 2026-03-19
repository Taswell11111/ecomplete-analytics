import React from 'react';
import { getStatusColor } from '../utils/statusConfig';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorClass = getStatusColor(status);
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", colorClass)}>
      {status}
    </span>
  );
};

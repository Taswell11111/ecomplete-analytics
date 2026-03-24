import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';

export const useInbounds = (days: number = 30, appContext: 'levis' | 'bounty' | 'admin' = 'admin') => {
  return useQuery({
    queryKey: ['shipments', 'inbound', days, appContext],
    queryFn: async () => {
      return apiClient.get('/shipments', {
        params: { type: 'inbound', days, appContext }
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

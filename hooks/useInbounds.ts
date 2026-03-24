import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';

export const useInbounds = (days: number = 30, appContext: 'levis' | 'bounty' | 'admin' = 'admin') => {
  return useQuery({
    queryKey: ['shipments', 'inbound', days, appContext],
    queryFn: async () => {
      const response = await apiClient.get('/shipments', {
        params: { type: 'inbound', days, appContext }
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

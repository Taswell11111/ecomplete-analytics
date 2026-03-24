import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';

export const useShipments = (days: number = 30, appContext: 'levis' | 'bounty' | 'admin' = 'admin') => {
  return useQuery({
    queryKey: ['shipments', 'outbound', days, appContext],
    queryFn: async () => {
      return apiClient.get('/shipments', {
        params: { type: 'outbound', days, appContext }
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

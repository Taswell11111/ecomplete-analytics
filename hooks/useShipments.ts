import { useQuery } from '@tanstack/react-query';

export const useShipments = (days: number = 30) => {
  return useQuery({
    queryKey: ['shipments', 'outbound', days],
    queryFn: async () => {
      const res = await fetch(`/api/shipments?type=outbound&days=${days}`);
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
};

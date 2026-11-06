import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes fresh in cache so prefetched data displays instantly
      gcTime: 1000 * 60 * 30,    // Keep unused cache for 30 minutes
    },
  },
});
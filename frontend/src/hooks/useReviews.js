import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

export default function useReviews() {
  const { data } = useQuery({
    queryKey: ['reviews-approved'],
    queryFn: async () => {
      const res = await apiClient.entities.Review.filter({ status: 'approved' });
      return res.items || [];
    },
  });
  return data || [];
}

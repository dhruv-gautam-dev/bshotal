import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { SAMPLE_REVIEWS } from '@/data/reviews';

export default function useReviews() {
  const { data } = useQuery({
    queryKey: ['reviews-approved'],
    queryFn: async () => (await apiClient.entities.Review.filter({ status: 'approved' }, { sort: '-created_date', limit: 50 })).items,
  });
  return [...(data || []), ...SAMPLE_REVIEWS];
}
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { SAMPLE_REVIEWS } from '@/data/reviews';

export default function useReviews() {
  const { data } = useQuery({
    queryKey: ['reviews-approved'],
    queryFn: async () => (await base44.entities.Review.filter({ status: 'approved' }, { sort: '-created_date', limit: 50 })).items,
  });
  return [...(data || []), ...SAMPLE_REVIEWS];
}
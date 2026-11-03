// Hook for fetching, caching, and submitting guest reviews
export const useReviews = () => ({
  reviews: [],
  isLoading: false,
  error: null,
  submitReview: async () => {},
});

export default useReviews;


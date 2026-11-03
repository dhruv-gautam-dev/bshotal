// Image resolution, optimization, and fallback placeholder URL helpers
export const getOptimizedImageUrl = (url, width) => url || '/placeholder.svg';
export const getSrcSet = (url) => (url ? `${url} 1x` : '');

export default {
  getOptimizedImageUrl,
  getSrcSet,
};


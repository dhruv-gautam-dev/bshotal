// Hook for querying live room types, menu offerings, and promotional packages
export const useSiteCatalog = () => ({
  rooms: [],
  menu: [],
  events: [],
  isLoading: false,
  error: null,
});

export default useSiteCatalog;


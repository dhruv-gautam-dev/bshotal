// Public API clients and fetch helpers for menu, room availability, and reviews
export const publicApi = {
  fetchRooms: async () => [],
  fetchMenu: async () => ({ categories: [], items: [] }),
  fetchReviews: async () => [],
  submitEnquiry: async (payload) => ({ success: true }),
  createBooking: async (payload) => ({ success: true }),
};

export default publicApi;


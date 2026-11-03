// Common business services and domain logic helpers
export const services = {
  formatCurrency: (amount) => `₹${amount}`,
  calculateRoomTotal: (price, nights) => price * nights,
};

export default services;


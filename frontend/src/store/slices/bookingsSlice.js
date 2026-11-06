import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  selectedBooking: null,
  isLoaded: false,
};

export const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setBookingsData: (state, action) => {
      const items = action.payload;
      if (Array.isArray(items)) {
        state.items = items;
      }
      state.isLoaded = true;
    },
    setSelectedBooking: (state, action) => {
      state.selectedBooking = action.payload;
    },
    // Instant optimistic update for booking status, room assignment, or notes
    updateBookingOptimistic: (state, action) => {
      const { id, ...updates } = action.payload || {};
      if (!id) return;
      
      const index = state.items.findIndex((b) => b.id === id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...updates };
      }
      if (state.selectedBooking && state.selectedBooking.id === id) {
        state.selectedBooking = { ...state.selectedBooking, ...updates };
      }
    },
    addBookingOptimistic: (state, action) => {
      const newBooking = action.payload;
      if (!newBooking) return;
      const id = newBooking.id || `temp-booking-${Date.now()}`;
      state.items.unshift({ ...newBooking, id });
    },
    deleteBookingOptimistic: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter((b) => b.id !== id);
      if (state.selectedBooking && state.selectedBooking.id === id) {
        state.selectedBooking = { ...state.selectedBooking, status: 'cancelled' };
      }
    },
    addPaymentOptimistic: (state, action) => {
      const { bookingId, amount } = action.payload || {};
      if (!bookingId || !amount) return;
      const payNum = Number(amount) || 0;
      const updateInPlace = (b) => {
        const newPaid = Number(b.advance_paid || 0) + payNum;
        const total = Number(b.amount || b.total_amount || 0);
        return {
          ...b,
          advance_paid: newPaid,
          balance: Math.max(0, total - newPaid),
          payment_status: newPaid >= total ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid'),
        };
      };

      const index = state.items.findIndex((b) => b.id === bookingId);
      if (index !== -1) {
        state.items[index] = updateInPlace(state.items[index]);
      }
      if (state.selectedBooking && state.selectedBooking.id === bookingId) {
        state.selectedBooking = updateInPlace(state.selectedBooking);
      }
    },
  },
});

export const {
  setBookingsData,
  setSelectedBooking,
  updateBookingOptimistic,
  addBookingOptimistic,
  deleteBookingOptimistic,
  addPaymentOptimistic,
} = bookingsSlice.actions;

export default bookingsSlice.reducer;


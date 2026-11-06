import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  activeOrder: null,
  isLoaded: false,
};

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrdersData: (state, action) => {
      const items = action.payload;
      if (Array.isArray(items)) {
        state.items = items;
      }
      state.isLoaded = true;
    },
    setActiveOrder: (state, action) => {
      state.activeOrder = action.payload;
    },
    // Instant optimistic update for status transition (e.g. new -> accepted -> preparing -> ready -> completed)
    updateOrderOptimistic: (state, action) => {
      const { id, ...updates } = action.payload || {};
      if (!id) return;

      const index = state.items.findIndex((o) => o.id === id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...updates };
      }
      if (state.activeOrder && state.activeOrder.id === id) {
        state.activeOrder = { ...state.activeOrder, ...updates };
      }
    },
    addOrderOptimistic: (state, action) => {
      const order = action.payload;
      if (!order) return;
      const id = order.id || `temp-order-${Date.now()}`;
      state.items.unshift({ ...order, id });
    },
    deleteOrderOptimistic: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter((o) => o.id !== id);
      if (state.activeOrder && state.activeOrder.id === id) {
        state.activeOrder = null;
      }
    },
  },
});

export const {
  setOrdersData,
  setActiveOrder,
  updateOrderOptimistic,
  addOrderOptimistic,
  deleteOrderOptimistic,
} = ordersSlice.actions;

export default ordersSlice.reducer;


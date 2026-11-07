import { createSlice } from '@reduxjs/toolkit';

export const STATUS_RANK = {
  new: 10,
  accepted: 20,
  preparing: 30,
  ready: 40,
  served: 50,
  out_for_delivery: 50,
  completed: 60,
  cancelled: 999,
};

export const getStatusRank = (status) => STATUS_RANK[status] || 0;

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
      const newItems = action.payload;
      if (!Array.isArray(newItems)) return;

      const now = Date.now();
      const existingMap = new Map((state.items || []).map((o) => [o.id, o]));

      state.items = newItems.map((newItem) => {
        const existing = existingMap.get(newItem.id);
        if (!existing) return newItem;

        // Terminal state: cancelled from server is always respected
        if (newItem.status === 'cancelled') {
          return newItem;
        }

        const existingRank = getStatusRank(existing.status);
        const incomingRank = getStatusRank(newItem.status);

        // Strict monotonicity guard:
        // If client order has advanced to a higher rank than incoming server data,
        // the server data is an out-of-order or stale intermediate snapshot.
        // NEVER allow a lower-rank server response to downgrade the order status!
        const resolvedStatus = existingRank > incomingRank ? existing.status : newItem.status;

        // Check if price or payment was optimistically modified recently (< 15 seconds)
        const hasRecentOptimisticEdit = existing._optimisticAt && (now - existing._optimisticAt < 15000);

        return {
          ...newItem,
          status: resolvedStatus,
          payment_status: hasRecentOptimisticEdit && existing.payment_status ? existing.payment_status : newItem.payment_status,
          payment_mode: hasRecentOptimisticEdit && existing.payment_mode ? existing.payment_mode : newItem.payment_mode,
          total: hasRecentOptimisticEdit && existing.total !== undefined ? existing.total : newItem.total,
          total_amount: hasRecentOptimisticEdit && existing.total_amount !== undefined ? existing.total_amount : newItem.total_amount,
          _optimisticAt: resolvedStatus !== newItem.status ? (existing._optimisticAt || now) : (hasRecentOptimisticEdit ? existing._optimisticAt : undefined),
        };
      });

      // Also preserve activeOrder state if open
      if (state.activeOrder) {
        const match = state.items.find((o) => o.id === state.activeOrder.id);
        if (match) {
          state.activeOrder = { ...match };
        }
      }

      state.isLoaded = true;
    },
    setActiveOrder: (state, action) => {
      state.activeOrder = action.payload;
    },
    // Instant optimistic update for status transition, price/amount, or notes
    updateOrderOptimistic: (state, action) => {
      const { id, ...updates } = action.payload || {};
      if (!id) return;

      const normUpdates = { ...updates };
      if (normUpdates.total !== undefined) {
        normUpdates.total_amount = Number(normUpdates.total);
      } else if (normUpdates.total_amount !== undefined) {
        normUpdates.total = Number(normUpdates.total_amount);
      }

      const apply = (o) => {
        let nextStatus = normUpdates.status !== undefined ? normUpdates.status : o.status;
        // Never downgrade status rank unless explicitly cancelling
        if (normUpdates.status && normUpdates.status !== 'cancelled') {
          const currentRank = getStatusRank(o.status);
          const targetRank = getStatusRank(normUpdates.status);
          if (currentRank > targetRank) {
            nextStatus = o.status;
          }
        }
        return {
          ...o,
          ...normUpdates,
          status: nextStatus,
          _optimisticAt: Date.now(),
        };
      };

      const index = state.items.findIndex((o) => o.id === id);
      if (index !== -1) {
        state.items[index] = apply(state.items[index]);
      }
      if (state.activeOrder && state.activeOrder.id === id) {
        state.activeOrder = apply(state.activeOrder);
      }
    },
    revertOrderOptimistic: (state, action) => {
      const { id, originalOrder } = action.payload || {};
      if (!id || !originalOrder) return;
      const index = state.items.findIndex((o) => o.id === id);
      if (index !== -1) {
        state.items[index] = { ...originalOrder };
      }
      if (state.activeOrder && state.activeOrder.id === id) {
        state.activeOrder = { ...originalOrder };
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
  revertOrderOptimistic,
  addOrderOptimistic,
  deleteOrderOptimistic,
} = ordersSlice.actions;

export default ordersSlice.reducer;

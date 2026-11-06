import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  categories: [],
  items: [],
  isLoaded: false,
};

export const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setMenuData: (state, action) => {
      const { categories, items } = action.payload || {};
      if (Array.isArray(categories)) state.categories = categories;
      if (Array.isArray(items)) state.items = items;
      state.isLoaded = true;
    },
    // Instant optimistic update for dish availability, price, etc.
    updateMenuItemOptimistic: (state, action) => {
      const updated = action.payload;
      if (!updated?.id) return;
      const index = state.items.findIndex((i) => i.id === updated.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...updated };
      }
    },
    addMenuItemOptimistic: (state, action) => {
      const item = action.payload;
      if (!item) return;
      const id = item.id || `temp-item-${Date.now()}`;
      state.items.unshift({ ...item, id });
    },
    deleteMenuItemOptimistic: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter((i) => i.id !== id);
    },
    bulkUpdatePricesOptimistic: (state, action) => {
      const updates = action.payload || [];
      const updateMap = Object.fromEntries(updates.map((u) => [u.id, u.price]));
      state.items = state.items.map((i) => {
        if (updateMap[i.id] !== undefined) {
          return { ...i, price: updateMap[i.id] };
        }
        return i;
      });
    },
    addCategoryOptimistic: (state, action) => {
      const cat = action.payload;
      if (!cat) return;
      const id = cat.id || `temp-cat-${Date.now()}`;
      state.categories.push({ ...cat, id });
    },
    deleteCategoryOptimistic: (state, action) => {
      const id = action.payload;
      state.categories = state.categories.filter((c) => c.id !== id);
    },
  },
});

export const {
  setMenuData,
  updateMenuItemOptimistic,
  addMenuItemOptimistic,
  deleteMenuItemOptimistic,
  bulkUpdatePricesOptimistic,
  addCategoryOptimistic,
  deleteCategoryOptimistic,
} = menuSlice.actions;

export default menuSlice.reducer;


import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: null,
  isLoaded: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettingsData: (state, action) => {
      state.data = action.payload;
      state.isLoaded = true;
    },
    // Instant optimistic update for hotel contact info, taxes, policies
    updateSettingsOptimistic: (state, action) => {
      state.data = {
        ...state.data,
        ...action.payload,
      };
    },
  },
});

export const {
  setSettingsData,
  updateSettingsOptimistic,
} = settingsSlice.actions;

export default settingsSlice.reducer;


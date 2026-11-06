import { configureStore } from '@reduxjs/toolkit';
import roomsReducer from './slices/roomsSlice';
import bookingsReducer from './slices/bookingsSlice';
import menuReducer from './slices/menuSlice';
import ordersReducer from './slices/ordersSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    rooms: roomsReducer,
    bookings: bookingsReducer,
    menu: menuReducer,
    orders: ordersReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;


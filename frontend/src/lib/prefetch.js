/**
 * High-performance prefetching engine for B.S. Hotel & Restaurant.
 * Fetches relevant data into React Query cache & Redux store before the user navigates,
 * ensuring instant zero-latency transitions across both public website and admin dashboard.
 */

import { fetchMenu, fetchRoomTypes, fetchEventPackages, getPublicSettings } from '@/lib/publicApi';
import { apiClient } from '@/api/apiClient';
import { getSettings } from '@/admin/lib/adminData';
import { setBookingsData } from '@/store/slices/bookingsSlice';
import { setOrdersData } from '@/store/slices/ordersSlice';
import { setRoomsData } from '@/store/slices/roomsSlice';
import { setMenuData } from '@/store/slices/menuSlice';
import { setSettingsData } from '@/store/slices/settingsSlice';

let publicPrefetched = false;
let adminPrefetched = false;

/**
 * Prefetch all public catalog data into React Query & Redux before user navigates.
 * Runs in background after initial paint.
 */
export async function prefetchPublicData(queryClient, dispatch) {
  if (publicPrefetched) return;
  publicPrefetched = true;

  try {
    // 1. Room Types & Pricing
    queryClient.prefetchQuery({
      queryKey: ['public-rooms'],
      queryFn: async () => {
        const rooms = await fetchRoomTypes();
        if (dispatch && Array.isArray(rooms)) {
          dispatch(setRoomsData({ types: rooms }));
        }
        return rooms;
      },
      staleTime: 1000 * 60 * 5,
    });

    // 2. Delicee Restaurant Menu
    queryClient.prefetchQuery({
      queryKey: ['public-menu'],
      queryFn: async () => {
        const menu = await fetchMenu();
        if (dispatch && Array.isArray(menu)) {
          const items = menu.flatMap((c) => c.items || []);
          dispatch(setMenuData({ categories: menu, items }));
        }
        return menu;
      },
      staleTime: 1000 * 60 * 5,
    });

    // 3. Event Packages
    queryClient.prefetchQuery({
      queryKey: ['public-events-packages'],
      queryFn: fetchEventPackages,
      staleTime: 1000 * 60 * 5,
    });

    // 4. Public Settings & Taxes
    queryClient.prefetchQuery({
      queryKey: ['public-settings'],
      queryFn: async () => {
        const s = await getPublicSettings();
        if (dispatch && s) {
          dispatch(setSettingsData(s));
        }
        return s;
      },
      staleTime: 1000 * 60 * 10,
    });

    // 5. Featured Reviews
    queryClient.prefetchQuery({
      queryKey: ['public-reviews'],
      queryFn: async () => {
        return await apiClient.entities.Review.list().catch(() => []);
      },
      staleTime: 1000 * 60 * 5,
    });
  } catch (err) {
    console.debug('Public prefetch background job completed with notice:', err);
  }
}

/**
 * Prefetch all admin dashboard modules into React Query & Redux in the background
 * immediately upon staff login / opening admin area.
 */
export async function prefetchAdminData(queryClient, dispatch) {
  if (adminPrefetched) return;
  adminPrefetched = true;

  try {
    // 1. Admin Bookings
    queryClient.prefetchQuery({
      queryKey: ['admin-bookings'],
      queryFn: async () => {
        const res = await apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 100 });
        const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        if (dispatch) dispatch(setBookingsData(list));
        return list;
      },
      staleTime: 1000 * 60 * 2,
    });

    // 2. Admin Food Orders
    queryClient.prefetchQuery({
      queryKey: ['admin-orders'],
      queryFn: async () => {
        const res = await apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 200 });
        const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        if (dispatch) dispatch(setOrdersData(list));
        return list;
      },
      staleTime: 1000 * 60 * 2,
    });

    // 3. Admin Rooms, Types, Blocks & Rules
    queryClient.prefetchQuery({
      queryKey: ['admin-rooms'],
      queryFn: async () => {
        const [types, rooms, bookings, blocks, rules] = await Promise.all([
          apiClient.entities.RoomType.filter({}, { sort: 'sort', limit: 100 }),
          apiClient.entities.Room.filter({}, { sort: 'number', limit: 200 }),
          apiClient.entities.Booking.filter({}, { sort: 'check_in', limit: 300 }),
          apiClient.entities.BlockedDate.filter({}, { sort: '-start_date', limit: 100 }),
          apiClient.entities.PricingRule.filter({}, { sort: '-start_date', limit: 100 }),
        ]);
        const res = { types: types.items, rooms: rooms.items, bookings: bookings.items, blocks: blocks.items, rules: rules.items };
        if (dispatch) dispatch(setRoomsData(res));
        return res;
      },
      staleTime: 1000 * 60 * 3,
    });

    // 4. Admin Menu Categories & Items
    queryClient.prefetchQuery({
      queryKey: ['admin-menu'],
      queryFn: async () => {
        const [categories, items] = await Promise.all([
          apiClient.entities.MenuCategory.list(),
          apiClient.entities.MenuItem.filter({}, { sort: 'sort', limit: 500 }),
        ]);
        const res = { categories: Array.isArray(categories) ? categories : [], items: items.items || [] };
        if (dispatch) dispatch(setMenuData(res));
        return res;
      },
      staleTime: 1000 * 60 * 3,
    });

    // 5. Admin Settings
    queryClient.prefetchQuery({
      queryKey: ['admin-settings'],
      queryFn: async () => {
        const s = await getSettings();
        if (dispatch && s) dispatch(setSettingsData(s));
        return s;
      },
      staleTime: 1000 * 60 * 10,
    });

    // 6. Admin Customers
    queryClient.prefetchQuery({
      queryKey: ['admin-customers'],
      queryFn: async () => {
        const [bookings, orders, customersRes] = await Promise.all([
          apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 300 }),
          apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 300 }),
          apiClient.entities.Customer.list().catch(() => []),
        ]);
        return {
          bookings: bookings.items || [],
          orders: orders.items || [],
          customers: Array.isArray(customersRes) ? customersRes : (customersRes?.items || []),
        };
      },
      staleTime: 1000 * 60 * 3,
    });

    // 7. Admin Enquiries
    queryClient.prefetchQuery({
      queryKey: ['admin-enquiries'],
      queryFn: async () => {
        return await apiClient.entities.Enquiry.list().catch(() => []);
      },
      staleTime: 1000 * 60 * 3,
    });
  } catch (err) {
    console.debug('Admin prefetch background job notice:', err);
  }
}

/**
 * Route-specific hover prefetch trigger for navigation links.
 */
export function prefetchOnHover(targetRoute, queryClient, dispatch) {
  if (!targetRoute || !queryClient) return;

  if (targetRoute.startsWith('/rooms') || targetRoute.startsWith('/booking')) {
    queryClient.prefetchQuery({ queryKey: ['public-rooms'], queryFn: fetchRoomTypes });
  } else if (targetRoute.startsWith('/restaurant') || targetRoute.startsWith('/order')) {
    queryClient.prefetchQuery({ queryKey: ['public-menu'], queryFn: fetchMenu });
    queryClient.prefetchQuery({ queryKey: ['public-settings'], queryFn: getPublicSettings });
  } else if (targetRoute.startsWith('/events')) {
    queryClient.prefetchQuery({ queryKey: ['public-events-packages'], queryFn: fetchEventPackages });
  } else if (targetRoute.startsWith('/admin')) {
    prefetchAdminData(queryClient, dispatch);
  }
}


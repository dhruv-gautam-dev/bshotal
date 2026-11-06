import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { setMenuData } from '@/store/slices/menuSlice';
import { setRoomsData } from '@/store/slices/roomsSlice';
import { setSettingsData } from '@/store/slices/settingsSlice';
import { fetchMenu, fetchRoomTypes, getPublicSettings } from '@/lib/publicApi';
import { useCart } from '@/lib/cart';
import { API_HOST } from '@/lib/apiConfig';

const CHANNEL_NAME = 'bs_hotel_live_sync';

export function useLiveSync() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const cart = useCart();
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => {
    let eventSource = null;
    let broadcastChannel = null;
    let reconnectTimeout = null;
    let isMounted = true;

    // Helper to invalidate and refresh Menu
    const handleMenuUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
      try {
        const menu = await fetchMenu();
        if (Array.isArray(menu)) {
          const items = menu.flatMap((c) => c.items || []);
          dispatch(setMenuData({ categories: menu, items }));
          if (cartRef.current?.syncPrices) {
            cartRef.current.syncPrices(menu);
          }
        }
      } catch (err) {
        console.debug('Failed to sync live menu:', err);
      }
    };

    // Helper to invalidate and refresh Rooms
    const handleRoomsUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['public-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-room-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-room-availability'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      try {
        const rooms = await fetchRoomTypes();
        if (Array.isArray(rooms)) {
          dispatch(setRoomsData({ types: rooms }));
        }
      } catch (err) {
        console.debug('Failed to sync live rooms:', err);
      }
    };

    // Helper to invalidate Bookings
    const handleBookingUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-room-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-room-availability'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    };

    // Helper to invalidate Orders
    const handleOrderUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['order-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    };

    // Helper to invalidate Settings
    const handleSettingsUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      try {
        const s = await getPublicSettings();
        if (s) dispatch(setSettingsData(s));
      } catch (err) {
        console.debug('Failed to sync live settings:', err);
      }
    };

    // Helper to invalidate Enquiries
    const handleEnquiryUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    };

    // Helper to invalidate Reviews
    const handleReviewUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews-approved'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    };

    // Helper to invalidate Event Packages
    const handlePackageUpdate = async () => {
      queryClient.invalidateQueries({ queryKey: ['public-events-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-enquiries'] });
    };

    // Setup Cross-Tab Broadcast Channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        broadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'menu_updated') handleMenuUpdate(payload);
          else if (type === 'rooms_updated') handleRoomsUpdate(payload);
          else if (type === 'booking_updated') handleBookingUpdate(payload);
          else if (type === 'order_updated' || type === 'new_order' || type === 'order_status_updated') handleOrderUpdate(payload);
          else if (type === 'settings_updated') handleSettingsUpdate(payload);
          else if (type === 'enquiry_updated') handleEnquiryUpdate(payload);
          else if (type === 'review_updated') handleReviewUpdate(payload);
          else if (type === 'event_package_updated') handlePackageUpdate(payload);
        };
      }
    } catch (e) {
      console.debug('BroadcastChannel not supported or failed to initialize:', e);
    }

    const broadcastToOtherTabs = (type, payload) => {
      try {
        if (broadcastChannel) {
          broadcastChannel.postMessage({ type, payload });
        }
      } catch (e) {
        // Ignore broadcast post error
      }
    };

    // Connect Server-Sent Events (SSE)
    const connectSSE = () => {
      if (!isMounted) return;
      try {
        const url = `${API_HOST}/api/v1/public/live/stream`;
        eventSource = new EventSource(url);

        eventSource.addEventListener('menu_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleMenuUpdate(data);
            broadcastToOtherTabs('menu_updated', data);
          } catch {
            handleMenuUpdate({});
            broadcastToOtherTabs('menu_updated', {});
          }
        });

        eventSource.addEventListener('rooms_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleRoomsUpdate(data);
            broadcastToOtherTabs('rooms_updated', data);
          } catch {
            handleRoomsUpdate({});
            broadcastToOtherTabs('rooms_updated', {});
          }
        });

        eventSource.addEventListener('booking_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleBookingUpdate(data);
            broadcastToOtherTabs('booking_updated', data);
          } catch {
            handleBookingUpdate({});
            broadcastToOtherTabs('booking_updated', {});
          }
        });

        const onOrderEvent = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleOrderUpdate(data);
            broadcastToOtherTabs('order_updated', data);
          } catch {
            handleOrderUpdate({});
            broadcastToOtherTabs('order_updated', {});
          }
        };

        eventSource.addEventListener('order_updated', onOrderEvent);
        eventSource.addEventListener('new_order', onOrderEvent);
        eventSource.addEventListener('order_status_updated', onOrderEvent);

        eventSource.addEventListener('settings_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleSettingsUpdate(data);
            broadcastToOtherTabs('settings_updated', data);
          } catch {
            handleSettingsUpdate({});
            broadcastToOtherTabs('settings_updated', {});
          }
        });

        eventSource.addEventListener('enquiry_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleEnquiryUpdate(data);
            broadcastToOtherTabs('enquiry_updated', data);
          } catch {
            handleEnquiryUpdate({});
            broadcastToOtherTabs('enquiry_updated', {});
          }
        });

        eventSource.addEventListener('review_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handleReviewUpdate(data);
            broadcastToOtherTabs('review_updated', data);
          } catch {
            handleReviewUpdate({});
            broadcastToOtherTabs('review_updated', {});
          }
        });

        eventSource.addEventListener('event_package_updated', (e) => {
          try {
            const data = JSON.parse(e.data);
            handlePackageUpdate(data);
            broadcastToOtherTabs('event_package_updated', data);
          } catch {
            handlePackageUpdate({});
            broadcastToOtherTabs('event_package_updated', {});
          }
        });

        eventSource.addEventListener('new_notification', () => {
          queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
          queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
          queryClient.invalidateQueries({ queryKey: ['overview'] });
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            // Reconnect after 3 seconds
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connectSSE, 3000);
          }
        };
      } catch (err) {
        console.debug('SSE connection error:', err);
        if (isMounted) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();

    // Re-verify freshness on tab focus or when browser comes back online
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
      queryClient.invalidateQueries({ queryKey: ['public-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['public-events-packages'] });
      queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      if (eventSource) {
        eventSource.close();
      }
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [queryClient, dispatch]);
}

/**
 * Utility function to emit local client-side mutations to other tabs immediately.
 */
export function emitLiveSyncEvent(type, payload = {}) {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({ type, payload });
      bc.close();
    }
  } catch {
    // Ignore error
  }
}


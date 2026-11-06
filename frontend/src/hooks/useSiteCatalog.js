import { useQuery } from '@tanstack/react-query';
import { fetchMenu, fetchRoomTypes, fetchEventPackages, getPublicSettings } from '@/lib/publicApi';
import { ORDER_CONFIG, SITE } from '@/data/site';

/** Live menu from the database; edits in the dashboard show up instantly. */
export function useMenu() {
  return useQuery({
    queryKey: ['public-menu'],
    queryFn: fetchMenu,
    staleTime: 3_000,
    refetchInterval: 6_000,
    refetchOnWindowFocus: true,
  });
}

/** Live room types and pricing from the database. */
export function useRoomTypes() {
  return useQuery({
    queryKey: ['public-rooms'],
    queryFn: fetchRoomTypes,
    staleTime: 3_000,
    refetchInterval: 6_000,
    refetchOnWindowFocus: true,
  });
}

/** Live event packages from the database. */
export function useEventPackages() {
  return useQuery({
    queryKey: ['public-events-packages'],
    queryFn: fetchEventPackages,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useOrderConfig() {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: getPublicSettings,
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  return {
    taxPercent: data?.taxPercent ?? ORDER_CONFIG.taxPercent,
    deliveryCharge: data?.deliveryCharge ?? ORDER_CONFIG.deliveryCharge,
  };
}

/** Live dynamic business contact numbers and settings from database */
export function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: getPublicSettings,
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const whatsappRaw = data?.whatsapp_number || data?.whatsapp || SITE.whatsapp;
  const whatsappDigits = String(whatsappRaw).replace(/\D/g, '');

  const bookingsPhone = data?.bookings_phone || data?.phone1 || SITE.phone1;
  const bookingsTel = bookingsPhone.replace(/[^\d+]/g, '');

  const enquiriesPhone = data?.enquiries_phone || data?.payments_phone || data?.phone2 || SITE.phone2;
  const enquiriesTel = enquiriesPhone.replace(/[^\d+]/g, '');

  return {
    settings: data,
    whatsappNumber: whatsappDigits,
    bookingsPhone,
    bookingsTel,
    enquiriesPhone,
    enquiriesTel,
    hotelName: data?.hotel_name || SITE.name,
    restaurantName: data?.restaurant_name || SITE.restaurant,
    address: data?.address || SITE.address,
    googleMapsUrl: data?.google_maps_url || SITE.mapEmbed,
  };
}

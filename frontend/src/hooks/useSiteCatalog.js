import { useQuery } from '@tanstack/react-query';
import { fetchMenu, fetchRoomTypes, fetchEventPackages, getPublicSettings } from '@/lib/publicApi';
import { ORDER_CONFIG } from '@/data/site';

/** Live menu from the database; edits in the dashboard show up within a minute. */
export function useMenu() {
  return useQuery({
    queryKey: ['public-menu'],
    queryFn: fetchMenu,
    staleTime: 60_000,
  });
}

/** Live room types and pricing from the database. */
export function useRoomTypes() {
  return useQuery({
    queryKey: ['public-rooms'],
    queryFn: fetchRoomTypes,
    staleTime: 60_000,
  });
}

/** Live event packages from the database. */
export function useEventPackages() {
  return useQuery({
    queryKey: ['public-events-packages'],
    queryFn: fetchEventPackages,
    staleTime: 60_000,
  });
}

export function useOrderConfig() {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });
  return {
    taxPercent: data?.taxPercent ?? ORDER_CONFIG.taxPercent,
    deliveryCharge: data?.deliveryCharge ?? ORDER_CONFIG.deliveryCharge,
  };
}

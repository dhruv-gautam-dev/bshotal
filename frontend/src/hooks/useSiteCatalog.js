import { useQuery } from '@tanstack/react-query';
import { fetchMenu, fetchRoomTypes, getPublicSettings } from '@/lib/publicApi';
import { MENU } from '@/data/menu';
import { ROOMS } from '@/data/rooms';
import { ORDER_CONFIG } from '@/data/site';

/** Menu lives in the database; edits in the dashboard show up within a minute. */
export function useMenu() {
  return useQuery({ queryKey: ['public-menu'], queryFn: fetchMenu, initialData: MENU, staleTime: 60_000 });
}

export function useRoomTypes() {
  return useQuery({ queryKey: ['public-rooms'], queryFn: fetchRoomTypes, initialData: ROOMS, staleTime: 60_000 });
}

export function useOrderConfig() {
  const { data } = useQuery({ queryKey: ['public-settings'], queryFn: getPublicSettings, staleTime: 60_000 });
  return {
    taxPercent: data?.taxPercent ?? ORDER_CONFIG.taxPercent,
    deliveryCharge: data?.deliveryCharge ?? ORDER_CONFIG.deliveryCharge,
  };
}
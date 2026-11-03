import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/site/PageHero';
import RoomCard from '@/components/site/RoomCard';
import RoomModal from '@/components/site/RoomModal';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

export default function Rooms() {
  const { t } = useI18n();
  const { data: rooms } = useRoomTypes();
  const nav = useNavigate();
  const [sel, setSel] = useState(null);
  useSeo('Rooms | B.S. Hotel, Mathura NH-2', 'Standard, Deluxe and Family rooms at B.S. Hotel near Township Nagar, NH-2, Baad (Mathura). AC, Wi-Fi, hot water.');
  return (
    <>
      <PageHero title={t('rooms.title')} sub={t('rooms.sub')} />
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {rooms.map((r) => <RoomCard key={r.id} room={r} onDetails={() => setSel(r)} onBook={() => nav(`/booking?room=${r.id}`)} />)}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">* Sample prices — final rates confirmed by the hotel. [REPLACE PRICES & PHOTOS]</p>
      </section>
      <RoomModal room={sel} onClose={() => setSel(null)} />
    </>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/site/PageHero';
import RoomCard from '@/components/site/RoomCard';
import RoomModal from '@/components/site/RoomModal';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { ROOMS } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

export default function Rooms() {
  const { t } = useI18n();
  const { data: rooms } = useRoomTypes();
  const nav = useNavigate();
  const [sel, setSel] = useState(null);
  const list = (rooms && rooms.length) ? rooms : ROOMS;

  useSeo(
    'Rooms & Suites | B.S. Hotel & Restaurant, Mathura',
    'Explore Standard, Deluxe and Family AC rooms at B.S. Hotel & Restaurant near Mathura Refinery, NH-19 (NH-2), Baad, Mathura. Free Wi-Fi, 24/7 room service & best direct booking rates.',
    {
      keywords: 'bs hotel rooms, b.s. hotel mathura rooms, bs hotel and restaurant booking, deluxe ac rooms mathura, hotel near mathura refinery',
      image: '/images/deluxe.webp',
    }
  );

  return (
    <>
      <PageHero title={t('rooms.title')} sub={t('rooms.sub')} />
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {list.map((r) => (
            <RoomCard key={r.id} room={r} onDetails={() => setSel(r)} onBook={() => nav(`/booking?room=${r.id}`)} />
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">* Sample prices — final rates confirmed by the hotel.</p>
      </section>
      <RoomModal room={sel} onClose={() => setSel(null)} />
    </>
  );
}

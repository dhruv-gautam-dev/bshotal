import { Link, useNavigate } from 'react-router-dom';
import RoomCard from '@/components/site/RoomCard';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { ROOMS } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';

export default function RoomsPreview() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { data: rooms } = useRoomTypes();
  const list = (rooms && rooms.length) ? rooms : ROOMS;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
      <SectionHeading title={t('rooms.title')} sub={t('rooms.sub')} />
      <div className="grid gap-6 md:grid-cols-3">
        {list.slice(0, 3).map((r, i) => (
          <Reveal key={r.id} delay={i * 0.1}>
            <RoomCard room={r} onDetails={() => nav('/rooms')} onBook={() => nav(`/booking?room=${r.id}`)} />
          </Reveal>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">* Sample prices — confirmed at booking.</p>
      <div className="mt-6 text-center"><Link to="/rooms" className="btn-outline">{t('cta.viewAll')}</Link></div>
    </section>
  );
}

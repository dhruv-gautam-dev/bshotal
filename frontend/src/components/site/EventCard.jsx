import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useI18n } from '@/lib/i18n';

export default function EventCard({ event }) {
  const { t, tr } = useI18n();
  const eventName = typeof event.name === 'object' ? tr(event.name) : (event.name || event.title);
  const eventImage = event.image || '/images/ring.webp';

  return (
    <Link to={`/events#${event.id}`} className="group relative block overflow-hidden rounded-2xl border border-primary/25">
      <Image src={eventImage} alt={eventName} loading="lazy" decoding="async" className="aspect-[4/5] w-full transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      <div className="absolute bottom-0 p-5">
        <h3 className="text-2xl font-semibold">{eventName}</h3>
        <span className="text-sm font-semibold text-primary">{t('cta.enquire')} →</span>
      </div>
    </Link>
  );
}

import { Check } from 'lucide-react';
import { Image } from '@/components/ui/image';
import Reveal from '@/components/site/Reveal';
import { INCLUDES } from '@/data/events';
import { useI18n } from '@/lib/i18n';

export default function EventStory({ event, index, onEnquire }) {
  const { t, tr } = useI18n();
  const eventName = typeof event.name === 'object' ? tr(event.name) : (event.name || event.title);
  const eventDesc = typeof event.desc === 'object' ? tr(event.desc) : (event.desc || event.description);
  const eventImage = event.image || '/images/ring.webp';
  const includesList = Array.isArray(event.includes) ? event.includes : [];

  return (
    <section id={event.id} className={`scroll-mt-20 border-b border-primary/20 py-14 ${index % 2 ? 'bg-card/40' : ''}`}>
      <div className={`mx-auto grid max-w-7xl items-center gap-8 px-4 md:grid-cols-2 ${index % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <Reveal>
          <Image src={eventImage} alt={eventName} loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-2xl border border-primary/30" />
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-4xl font-semibold">{eventName}</h2>
          <p className="mt-3 text-muted-foreground">{eventDesc}</p>
          <p className="mt-4 text-sm"><b className="text-primary">Capacity:</b> {event.capacity}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {includesList.map((k, idx) => {
              const label = (INCLUDES && INCLUDES[k]) ? tr(INCLUDES[k]) : String(k);
              return (
                <li key={idx} className="flex items-center gap-2">
                  <Check size={16} className="text-primary shrink-0" />
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-gold mt-6" onClick={() => onEnquire(event.value || eventName)}>{t('cta.enquire')}</button>
        </Reveal>
      </div>
    </section>
  );
}

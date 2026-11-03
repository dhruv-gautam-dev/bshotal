import { Check } from 'lucide-react';
import { Image } from '@/components/ui/image';
import Reveal from '@/components/site/Reveal';
import { INCLUDES } from '@/data/events';
import { useI18n } from '@/lib/i18n';

export default function EventStory({ event, index, onEnquire }) {
  const { t, tr } = useI18n();
  return (
    <section id={event.id} className={`scroll-mt-20 border-b border-primary/20 py-14 ${index % 2 ? 'bg-card/40' : ''}`}>
      <div className={`mx-auto grid max-w-7xl items-center gap-8 px-4 md:grid-cols-2 ${index % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <Reveal><Image src={event.image} alt={tr(event.name)} className="aspect-[3/2] w-full rounded-2xl border border-primary/30" /></Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-4xl font-semibold">{tr(event.name)}</h2>
          <p className="mt-3 text-muted-foreground">{tr(event.desc)}</p>
          <p className="mt-4 text-sm"><b className="text-primary">Capacity:</b> {event.capacity}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {event.includes.map((k) => <li key={k} className="flex items-center gap-2"><Check size={16} className="text-primary" />{tr(INCLUDES[k])}</li>)}
          </ul>
          <button type="button" className="btn-gold mt-6" onClick={() => onEnquire(event.value)}>{t('cta.enquire')}</button>
        </Reveal>
      </div>
    </section>
  );
}
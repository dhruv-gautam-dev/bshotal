import EventCard from '@/components/site/EventCard';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { useEventPackages } from '@/hooks/useSiteCatalog';
import { EVENTS } from '@/data/events';
import { useI18n } from '@/lib/i18n';

export default function EventsPreview() {
  const { t } = useI18n();
  const { data: packages } = useEventPackages();
  const list = (packages && packages.length) ? packages : EVENTS;

  return (
    <section className="border-y border-primary/20 bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading title={t('events.title')} sub={t('events.sub')} />
        <div className="grid gap-5 md:grid-cols-3">
          {list.map((e, i) => <Reveal key={e.id} delay={i * 0.1}><EventCard event={e} /></Reveal>)}
        </div>
      </div>
    </section>
  );
}

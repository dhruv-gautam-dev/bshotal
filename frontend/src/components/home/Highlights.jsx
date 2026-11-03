import { Link } from 'react-router-dom';
import { BedDouble, Utensils, PartyPopper } from 'lucide-react';
import Reveal from '@/components/site/Reveal';
import SectionHeading from '@/components/site/SectionHeading';
import { useI18n } from '@/lib/i18n';

export default function Highlights() {
  const { t } = useI18n();
  const items = [
    [BedDouble, 'hl.rooms', 'hl.roomsD', '/rooms'],
    [Utensils, 'hl.food', 'hl.foodD', '/restaurant'],
    [PartyPopper, 'hl.events', 'hl.eventsD', '/events'],
  ];
  return (
    <section className="jali mx-auto max-w-7xl px-4 py-20 md:py-28">
      <SectionHeading title={t('hl.title')} />
      <div className="grid gap-5 md:grid-cols-3">
        {items.map(([Icon, a, b, to], i) => (
          <Reveal key={a} delay={i * 0.1}>
            <Link to={to} className="block h-full rounded-2xl border border-primary/25 bg-card p-8 text-center transition hover:-translate-y-1 hover:border-primary">
              <Icon className="mx-auto text-primary" size={36} />
              <h3 className="mt-4 text-2xl font-semibold">{t(a)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(b)}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
import { Link } from 'react-router-dom';
import DishCard from '@/components/site/DishCard';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { FEATURED } from '@/data/menu';
import { useI18n } from '@/lib/i18n';

export default function FeaturedDishes() {
  const { t } = useI18n();
  return (
    <section className="border-y border-primary/20 bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading eyebrow="Delicee Restaurant" title={t('feat.title')} sub={t('feat.sub')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((d, i) => <Reveal key={d.id} delay={(i % 4) * 0.08}><DishCard item={d} /></Reveal>)}
        </div>
        <div className="mt-10 text-center"><Link to="/restaurant" className="btn-gold">{t('cta.viewMenu')}</Link></div>
      </div>
    </section>
  );
}
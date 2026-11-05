import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DishCard from '@/components/site/DishCard';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { useMenu } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';

export default function FeaturedDishes() {
  const { t } = useI18n();
  const { data: menu } = useMenu();

  const featured = useMemo(() => {
    if (!menu || !menu.length) return [];
    const allDishes = menu.flatMap((c) => c.items || []);
    const special = allDishes.filter((d) => (d.tags || []).includes('popular') || (d.tags || []).includes('chef-special'));
    return (special.length ? special : allDishes).slice(0, 4);
  }, [menu]);

  return (
    <section className="border-y border-primary/20 bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading eyebrow="Delicee Restaurant" title={t('feat.title')} sub={t('feat.sub')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((d, i) => <Reveal key={d.id} delay={(i % 4) * 0.08}><DishCard item={d} /></Reveal>)}
        </div>
        <div className="mt-10 text-center"><Link to="/restaurant" className="btn-gold">{t('cta.viewMenu')}</Link></div>
      </div>
    </section>
  );
}
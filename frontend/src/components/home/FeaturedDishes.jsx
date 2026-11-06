import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DishCard from '@/components/site/DishCard';
import SectionHeading from '@/components/site/SectionHeading';
import Reveal from '@/components/site/Reveal';
import { useMenu } from '@/hooks/useSiteCatalog';
import { FEATURED } from '@/data/menu';
import { useI18n } from '@/lib/i18n';

export default function FeaturedDishes() {
  const { t } = useI18n();
  const { data: menu } = useMenu();

  const featured = useMemo(() => {
    if (menu && menu.length) {
      const allDishes = menu.flatMap((c) => c.items || []);
      const special = allDishes.filter((d) => (d.tags || []).includes('popular') || (d.tags || []).includes('chef-special'));
      if (special.length >= 10) return special.slice(0, 10);
      const set = new Set(special.map((s) => s.id));
      const combined = [...special, ...allDishes.filter((d) => !set.has(d.id))];
      if (combined.length) return combined.slice(0, 10);
    }
    return (FEATURED || []).slice(0, 10);
  }, [menu]);

  return (
    <section className="border-y border-primary/20 bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading eyebrow="Delicee Restaurant" title={t('feat.title')} sub={t('feat.sub')} />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {featured.map((d, i) => <Reveal key={d.id} delay={(i % 5) * 0.06}><DishCard item={d} /></Reveal>)}
        </div>
        <div className="mt-10 text-center"><Link to="/restaurant" className="btn-gold">{t('cta.viewMenu')}</Link></div>
      </div>
    </section>
  );
}

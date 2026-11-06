import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { IMAGES, SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import { useSiteSettings } from '@/hooks/useSiteCatalog';

export default function HomeHero() {
  const { t, tr } = useI18n();
  const { bookingsTel } = useSiteSettings();
  return (
    <section className="relative flex min-h-[88vh] items-end overflow-hidden pt-16">
      <Image src={IMAGES.hero} alt="B.S. Hotel entrance at dusk" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" decoding="sync" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 md:pb-28">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t('hero.eyebrow')}</p>
        <h1 className="max-w-3xl font-semibold leading-[1.1]" style={{ fontSize: 'calc(2rem + 3.5vw)' }}>{t('hero.title')}</h1>
        <p className="mt-4 max-w-xl text-base text-foreground/85 md:text-lg">{t('hero.sub')}</p>
        <p className="mt-2 font-heading text-xl italic text-primary">{tr(SITE.tagline)}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/booking" className="btn-gold">{t('cta.bookRoom')}</Link>
          <Link to="/restaurant" className="btn-outline bg-background/40">{t('cta.orderFood')}</Link>
          <a href={`tel:${bookingsTel}`} className="btn-outline bg-background/40"><Phone size={18} />{t('cta.callUs')}</a>
        </div>
      </div>
    </section>
  );
}
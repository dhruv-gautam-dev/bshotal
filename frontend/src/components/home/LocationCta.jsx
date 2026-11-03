import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import SectionHeading from '@/components/site/SectionHeading';
import { SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';

export default function LocationCta() {
  const { t, tr } = useI18n();
  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col justify-center">
          <SectionHeading align="left" title={t('loc.title')} />
          <p className="flex gap-2 text-lg"><MapPin className="mt-1 shrink-0 text-primary" />{tr(SITE.address)}</p>
          <a href={SITE.mapLink} target="_blank" rel="noopener noreferrer" className="btn-outline mt-6 w-fit">Google Maps →</a>
        </div>
        <iframe title="B.S. Hotel location" src={SITE.mapEmbed} loading="lazy" className="h-80 w-full rounded-2xl border border-primary/30" />
      </section>
      <section className="border-t border-primary/30 bg-card py-16 text-center">
        <h2 className="px-4 text-3xl font-semibold md:text-4xl">{t('cta.final')}</h2>
        <p className="mx-auto mt-2 max-w-lg px-4 text-muted-foreground">{t('cta.finalSub')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 px-4">
          <Link to="/booking" className="btn-gold">{t('cta.bookRoom')}</Link>
          <a href={`tel:${SITE.tel1}`} className="btn-outline"><Phone size={18} />{SITE.phone1}</a>
        </div>
      </section>
    </>
  );
}
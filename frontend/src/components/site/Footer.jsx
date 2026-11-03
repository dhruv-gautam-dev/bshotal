import { Link } from 'react-router-dom';
import { Phone, MessageCircle, MapPin, Instagram, Facebook, Youtube } from 'lucide-react';
import { SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import { waLink } from '@/lib/whatsapp';
import Logo from '@/components/site/Logo';

export default function Footer() {
  const { t, tr } = useI18n();
  const quick = [['/rooms', 'nav.rooms'], ['/restaurant', 'nav.restaurant'], ['/order', 'nav.order'], ['/events', 'nav.events'], ['/gallery', 'nav.gallery'], ['/reviews', 'nav.reviews'], ['/contact', 'nav.contact']];
  return (
    <footer className="jali border-t border-primary/30 bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo variant="full" className="w-[220px] sm:w-[250px]" />
          <div className="mt-4 flex gap-2">
            {[[Instagram, SITE.social.instagram, 'Instagram'], [Facebook, SITE.social.facebook, 'Facebook'], [Youtube, SITE.social.youtube, 'YouTube']].map(([Icon, href, label]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 text-primary"><Icon size={18} /></a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-body text-sm font-semibold uppercase tracking-widest text-primary">{t('footer.contact')}</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><MapPin size={18} className="mt-0.5 shrink-0 text-primary" />{tr(SITE.address)}</li>
            <li><a className="flex items-center gap-2 py-1" href={`tel:${SITE.tel1}`}><Phone size={18} className="text-primary shrink-0" /><span>{SITE.phone1} <span className="text-xs text-muted-foreground">({t('nav.rooms') || 'Bookings'})</span></span></a></li>
            <li><a className="flex items-center gap-2 py-1" href={`tel:${SITE.tel2}`}><Phone size={18} className="text-primary shrink-0" /><span>{SITE.phone2} <span className="text-xs text-muted-foreground">(Payments)</span></span></a></li>
            <li><a className="flex items-center gap-2 py-1" href={waLink()} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} className="text-primary" />WhatsApp</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-body text-sm font-semibold uppercase tracking-widest text-primary">{t('footer.links')}</h3>
          <ul className="space-y-1 text-sm">
            {quick.map(([to, k]) => <li key={to}><Link className="inline-block py-1.5 hover:text-primary" to={to}>{t(k)}</Link></li>)}
          </ul>
        </div>
        <div>
          <iframe title="Map" src={SITE.mapEmbed} loading="lazy" className="h-44 w-full rounded-xl border border-primary/30" />
        </div>
      </div>
      <div className="gold-rule" />
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
        <p>{t('footer.fssai')}: {SITE.fssai} · {t('footer.gst')}: {SITE.gst}</p>
        <p className="flex flex-wrap gap-x-4">
          <Link to="/privacy-policy" className="py-1">{t('footer.privacy')}</Link>
          <Link to="/terms" className="py-1">{t('footer.terms')}</Link>
          <Link to="/cancellation-refund" className="py-1">{t('footer.refund')}</Link>
          <Link to="/admin" className="py-1">Staff login</Link>
        </p>
        <p>© {new Date().getFullYear()} B.S. Hotel & Restaurant. {t('footer.rights')}</p>
      </div>
    </footer>
  );
}
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Phone, MessageCircle, BedDouble } from 'lucide-react';
import { SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import { waLink } from '@/lib/whatsapp';
import { prefetchOnHover } from '@/lib/prefetch';

export default function MobileBar() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const cls = 'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold';
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-primary/40 bg-background/95 backdrop-blur md:hidden">
      <a href={`tel:${SITE.tel1}`} className={`${cls} text-primary`}><Phone size={20} />{t('cta.call')}</a>
      <a href={waLink('Hello, I would like to know more about B.S. Hotel.')} target="_blank" rel="noopener noreferrer" className={`${cls} text-green-400`}><MessageCircle size={20} />{t('cta.whatsapp')}</a>
      <Link
        to="/booking"
        className={`${cls} bg-primary text-primary-foreground`}
        onTouchStart={() => prefetchOnHover('/booking', queryClient, dispatch)}
        onMouseEnter={() => prefetchOnHover('/booking', queryClient, dispatch)}
      >
        <BedDouble size={20} />
        {t('cta.bookRoom')}
      </Link>
    </div>
  );
}
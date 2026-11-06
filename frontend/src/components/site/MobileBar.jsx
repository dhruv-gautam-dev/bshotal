import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Phone, UtensilsCrossed, BedDouble } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { prefetchOnHover } from '@/lib/prefetch';
import { useSiteSettings } from '@/hooks/useSiteCatalog';

export default function MobileBar() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { bookingsTel } = useSiteSettings();
  const cls = 'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-primary/40 bg-background/95 backdrop-blur md:hidden">
      <a href={`tel:${bookingsTel}`} className={`${cls} text-primary`}>
        <Phone size={20} />
        {t('cta.call')}
      </a>
      <Link
        to="/restaurant"
        className={`${cls} text-amber-500 hover:text-amber-400`}
        onTouchStart={() => prefetchOnHover('/restaurant', queryClient, dispatch)}
        onMouseEnter={() => prefetchOnHover('/restaurant', queryClient, dispatch)}
      >
        <UtensilsCrossed size={20} />
        {t('cta.orderFood')}
      </Link>
      <Link
        to="/rooms"
        className={`${cls} bg-primary text-primary-foreground`}
        onTouchStart={() => prefetchOnHover('/rooms', queryClient, dispatch)}
        onMouseEnter={() => prefetchOnHover('/rooms', queryClient, dispatch)}
      >
        <BedDouble size={20} />
        {t('cta.bookRoom')}
      </Link>
    </div>
  );
}

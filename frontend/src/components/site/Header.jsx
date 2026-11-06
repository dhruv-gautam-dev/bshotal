import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useCart } from '@/lib/cart';
import Logo from '@/components/site/Logo';
import { prefetchOnHover } from '@/lib/prefetch';

const NAV = [
  ['/', 'nav.home'], ['/rooms', 'nav.rooms'], ['/restaurant', 'nav.restaurant'],
  ['/events', 'nav.events'], ['/gallery', 'nav.gallery'], ['/reviews', 'nav.reviews'], ['/contact', 'nav.contact'],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { t, lang, setLang } = useI18n();
  const { count } = useCart();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const linkCls = ({ isActive }) => `px-3 py-2 text-sm font-medium transition ${isActive ? 'text-primary' : 'text-foreground/80 hover:text-primary'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-primary/25 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 leading-tight" onClick={() => setOpen(false)}>
          <Logo variant="mark" className="h-10 sm:h-11" />
          <span>
            <span className="block font-heading text-xl font-bold text-primary">B.S. Hotel</span>
            <span className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Delicee Restaurant</span>
          </span>
        </Link>
        <nav className="hidden items-center lg:flex" aria-label="Main">
          {NAV.map(([to, k]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={linkCls}
              onMouseEnter={() => prefetchOnHover(to, queryClient, dispatch)}
              onTouchStart={() => prefetchOnHover(to, queryClient, dispatch)}
            >
              {t(k)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="min-h-[44px] rounded-full border border-primary/50 px-3 text-sm font-semibold text-primary" aria-label="Change language">{t('lang.switch')}</button>
          <Link
            to="/order"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-primary"
            aria-label={t('nav.order')}
            onMouseEnter={() => prefetchOnHover('/order', queryClient, dispatch)}
            onTouchStart={() => prefetchOnHover('/order', queryClient, dispatch)}
          >
            <ShoppingBag size={22} />
            {count > 0 && <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{count}</span>}
          </Link>
          <Link
            to="/rooms"
            className="btn-gold hidden sm:inline-flex"
            onMouseEnter={() => prefetchOnHover('/rooms', queryClient, dispatch)}
            onTouchStart={() => prefetchOnHover('/rooms', queryClient, dispatch)}
          >
            {t('cta.bookNow')}
          </Link>
          <button type="button" className="flex h-11 w-11 items-center justify-center lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-primary/20 bg-background px-4 pb-4 lg:hidden" aria-label="Mobile">
          {[...NAV, ['/order', 'nav.order'], ['/rooms', 'cta.bookNow']].map(([to, k]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block border-b border-primary/10 py-3 text-base ${isActive ? 'text-primary' : ''}`}
              onTouchStart={() => prefetchOnHover(to, queryClient, dispatch)}
            >
              {t(k)}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
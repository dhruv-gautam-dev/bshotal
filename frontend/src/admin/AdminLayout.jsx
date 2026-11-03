import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarCheck, UtensilsCrossed, BedDouble, MessageSquare,
  Star, Users, BarChart3, Settings, LogOut, Menu, X, Globe, KeyRound,
} from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from './AdminContext';

export default function AdminLayout() {
  const { me, can } = useAdmin();
  const { lang, setLang, L } = useI18n();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const NAV = [
    ['/admin', LayoutDashboard, L('Overview', 'अवलोकन'), 'overview', true],
    ['/admin/bookings', CalendarCheck, L('Bookings', 'बुकिंग'), 'bookings'],
    ['/admin/orders', UtensilsCrossed, L('Orders', 'ऑर्डर'), 'orders'],
    ['/admin/rooms', BedDouble, L('Rooms & availability', 'कमरे और उपलब्धता'), 'rooms'],
    ['/admin/menu', UtensilsCrossed, L('Menu', 'मेन्यू'), 'menu'],
    ['/admin/enquiries', MessageSquare, L('Enquiries', 'पूछताछ'), 'enquiries'],
    ['/admin/reviews', Star, L('Reviews', 'समीक्षाएँ'), 'reviews'],
    ['/admin/customers', Users, L('Customers', 'ग्राहक'), 'customers'],
    ['/admin/reports', BarChart3, L('Reports', 'रिपोर्ट'), 'reports'],
    ['/admin/settings', Settings, L('Settings', 'सेटिंग्स'), 'settings'],
  ].filter(([, , , area]) => can(area));

  const logout = async () => {
    await apiClient.auth.logout();
    navigate('/admin/login');
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <Link to="/admin" className="leading-tight" onClick={() => setOpen(false)}>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600">B.S. Hotel</span>
          <span className="block text-lg font-semibold text-slate-900">{L('Dashboard', 'डैशबोर्ड')}</span>
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(([to, Icon, label, , end]) => (
          <NavLink key={to} to={to} end={end} className={linkCls} onClick={() => setOpen(false)}>
            <Icon size={18} /> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3 text-sm">
        <p className="truncate px-3 pb-1 text-xs text-slate-500">{me?.email}</p>
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{me?.staff_role}</p>
        <div className="flex gap-2">
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600">
            <Globe size={14} /> {lang === 'en' ? 'हिन्दी' : 'English'}
          </button>
          <Link to="/forgot-password" className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600" title={L('Change password', 'पासवर्ड बदलें')}>
            <KeyRound size={14} /> {L('Password', 'पासवर्ड')}
          </Link>
        </div>
        <button onClick={logout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white">
          <LogOut size={14} /> {L('Sign out', 'साइन आउट')}
        </button>
        <Link to="/" className="mt-2 block text-center text-[11px] text-slate-500 hover:underline">{L('View website', 'वेबसाइट देखें')}</Link>
      </div>
    </div>
  );

  const bottom = NAV.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-700" aria-label="Open menu"><Menu size={20} /></button>
          <span className="font-semibold text-slate-900">B.S. Hotel</span>
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:pb-10">
          <div key={location.pathname}><Outlet /></div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {bottom.map(([to, Icon, label, , end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] ${isActive ? 'text-amber-700' : 'text-slate-500'}`}>
            <Icon size={20} /><span className="max-w-full truncate px-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
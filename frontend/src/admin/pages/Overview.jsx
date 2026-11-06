import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, UtensilsCrossed, Ban, PlusCircle } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { inr, todayISO, money } from '../lib/adminData';
import StatCard from '../components/StatCard';
import { RevenueChart, OrdersChart, BarList } from '../components/Charts';

const dayKey = (d) => d.toISOString().slice(0, 10);

export default function Overview() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [range, setRange] = useState(7);
  const today = todayISO();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const [bookings, orders, reviews, roomTypes, rooms] = await Promise.all([
        apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 300 }),
        apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 300 }),
        apiClient.entities.Review.filter({}, { sort: '-created_date', limit: 100 }),
        apiClient.entities.RoomType.filter({ is_active: true }, { limit: 50 }),
        apiClient.entities.Room.filter({ is_active: true }, { limit: 200 }),
      ]);
      // Staff may not read enquiries or payments, so only owners/managers fetch them.
      let enquiries = { items: [] };
      let payments = { items: [] };
      if (me?.staff_role !== 'staff') {
        [enquiries, payments] = await Promise.all([
          apiClient.entities.Enquiry.filter({}, { sort: '-created_date', limit: 200 }),
          apiClient.entities.Payment.filter({}, { sort: '-created_date', limit: 200 }),
        ]);
      }
      return {
        bookings: bookings.items, orders: orders.items, enquiries: enquiries.items,
        reviews: reviews.items, payments: payments.items,
        roomTypes: roomTypes.items, rooms: rooms.items,
      };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const bookings = data.bookings || [];
    const orders = data.orders || [];
    const enquiries = data.enquiries || [];
    const reviews = data.reviews || [];
    const payments = data.payments || [];
    const roomTypes = data.roomTypes || [];
    const rooms = data.rooms || [];
    const active = bookings.filter((b) => ['pending', 'confirmed', 'checked_in'].includes(b.status));
    const occupied = Math.max(
      active.filter((b) => b.status === 'checked_in').length,
      rooms.filter((r) => r.status === 'occupied').length,
    );
    const totalRooms = roomTypes.reduce((s, t) => s + (Number(t.total_rooms ?? t.total_inventory) || 0), 0);
    const revenueToday =
      orders.filter((o) => (o.created_date || '').startsWith(today) && o.status !== 'cancelled').reduce((s, o) => s + money(o.total), 0) +
      payments.filter((p) => (p.paid_at || '').startsWith(today)).reduce((s, p) => s + money(p.amount), 0);

    return {
      newBookings: bookings.filter((b) => b.status === 'pending').length,
      arrivals: bookings.filter((b) => b.check_in === today && ['pending', 'confirmed'].includes(b.status)).length,
      departures: bookings.filter((b) => b.check_out === today && b.status === 'checked_in').length,
      occupied, available: Math.max(0, totalRooms - occupied),
      newOrders: orders.filter((o) => o.status === 'new').length,
      pendingOrders: orders.filter((o) => ['new', 'accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
      revenueToday,
      newEnquiries: enquiries.filter((e) => e.status === 'new').length,
      pendingReviews: reviews.filter((r) => r.status === 'pending').length,
      attention: [
        ...bookings.filter((b) => b.status === 'pending').slice(0, 4).map((b) => ({
          to: `/admin/bookings/${b.id}`, title: `${b.guest_name} · ${b.check_in}`, tag: L('Booking to confirm', 'बुकिंग कन्फ़र्म करें'),
        })),
        ...orders.filter((o) => ['new', 'preparing'].includes(o.status)).slice(0, 4).map((o) => ({
          to: '/admin/orders', title: `#${o.ref} · ${o.customer_name}`, tag: L('Order in progress', 'ऑर्डर चल रहा है'),
        })),
        ...enquiries.filter((e) => e.status === 'new').slice(0, 3).map((e) => ({
          to: '/admin/enquiries', title: `${e.name} · ${e.type}`, tag: L('Enquiry unanswered', 'पूछताछ बाकी'),
        })),
        ...reviews.filter((r) => r.status === 'pending').slice(0, 3).map((r) => ({
          to: '/admin/reviews', title: `${r.name} · ${r.rating}★`, tag: L('Review awaiting approval', 'समीक्षा स्वीकृति बाकी'),
        })),
      ],
    };
  }, [data, today, L]);

  const series = useMemo(() => {
    if (!data) return [];
    const orders = data.orders || [];
    const payments = data.payments || [];
    const out = [];
    for (let i = range - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const revenue =
        orders.filter((o) => (o.created_date || o.created_at || '').startsWith(key) && o.status !== 'cancelled').reduce((s, o) => s + money(o.total), 0) +
        payments.filter((p) => (p.paid_at || p.created_at || '').startsWith(key)).reduce((s, p) => s + money(p.amount), 0);
      out.push({
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        revenue,
        orders: orders.filter((o) => (o.created_date || o.created_at || '').startsWith(key) && o.status !== 'cancelled').length,
      });
    }
    return out;
  }, [data, range]);

  const byType = useMemo(() => {
    if (!data) return [];
    const bookings = data.bookings || [];
    const map = new Map();
    bookings.forEach((b) => {
      const k = b.room_type_name || 'Room';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [data]);

  const topDishes = useMemo(() => {
    if (!data) return [];
    const orders = data.orders || [];
    const map = new Map();
    orders.filter((o) => o.status !== 'cancelled').forEach((o) => (o.items || []).forEach((i) => {
      map.set(i.name, (map.get(i.name) || 0) + (Number(i.qty) || 0));
    }));
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [data]);

  if (isLoading || !stats) {
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>;
  }

  const isStaff = me?.staff_role === 'staff';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{L('Today at B.S. Hotel', 'आज बी.एस. होटल में')}</h1>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={L('New bookings', 'नई बुकिंग')} value={stats.newBookings} tone="amber" />
        <StatCard label={L('Check-ins today', 'आज चेक-इन')} value={stats.arrivals} tone="blue" />
        <StatCard label={L('Check-outs today', 'आज चेक-आउट')} value={stats.departures} />
        <StatCard label={L('Rooms occupied', 'कमरे भरे')} value={`${stats.occupied}/${stats.occupied + stats.available}`} hint={`${stats.available} ${L('free', 'खाली')}`} />
        <StatCard label={L('New orders', 'नए ऑर्डर')} value={stats.newOrders} tone="amber" />
        <StatCard label={L('Orders in progress', 'चल रहे ऑर्डर')} value={stats.pendingOrders} />
        {!isStaff && <StatCard label={L('Revenue today', 'आज की आय')} value={inr(stats.revenueToday)} tone="emerald" />}
        <StatCard label={L('New enquiries', 'नई पूछताछ')} value={stats.newEnquiries} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link to="/admin/bookings?new=1" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"><CalendarPlus size={16} />{L('New booking', 'नई बुकिंग')}</Link>
        <Link to="/admin/orders?new=1" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-white"><UtensilsCrossed size={16} />{L('New order', 'नया ऑर्डर')}</Link>
        <Link to="/admin/rooms?tab=blocks" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><Ban size={16} />{L('Block dates', 'तारीखें बंद करें')}</Link>
        <Link to="/admin/menu?new=1" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><PlusCircle size={16} />{L('Add dish', 'डिश जोड़ें')}</Link>
      </div>

      {!isStaff && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{L('Revenue', 'आय')}</h2>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              {[7, 30].map((d) => (
                <button key={d} onClick={() => setRange(d)} className={`rounded-md px-3 py-1 ${range === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{d}d</button>
              ))}
            </div>
          </div>
          <RevenueChart data={series} />
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Orders', 'ऑर्डर')}</h3>
            <OrdersChart data={series} />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">{L('Needs attention', 'ध्यान चाहिए')}</h2>
          {stats.attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{L('All clear. Nothing waiting.', 'सब ठीक है। कुछ बाकी नहीं।')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.attention.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.title}</span>
                      <span className="block text-xs text-amber-700">{a.tag}</span>
                    </span>
                    <span className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-900">{L('Bookings by room type', 'कमरे के प्रकार से बुकिंग')}</h2>
            <BarList rows={byType} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-900">{L('Top-selling dishes', 'सबसे ज़्यादा बिकने वाली डिश')}</h2>
            <BarList rows={topDishes} format={(v) => `${v}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
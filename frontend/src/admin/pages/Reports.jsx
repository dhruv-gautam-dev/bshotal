import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { downloadCsv, inr, money, printHtml, todayISO } from '../lib/adminData';
import { RevenueChart, BarList } from '../components/Charts';

const startOfMonth = () => `${todayISO().slice(0, 7)}-01`;

export default function Reports() {
  const { L } = useI18n();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayISO());

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', from, to],
    queryFn: async () => {
      const [bookings, orders, payments, types] = await Promise.all([
        apiClient.entities.Booking.filter({ check_in: { $gte: from, $lte: to } }, { limit: 300 }),
        apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 500 }),
        apiClient.entities.Payment.filter({}, { sort: '-created_date', limit: 300 }),
        apiClient.entities.RoomType.filter({}, { limit: 50 }),
      ]);
      return { bookings: bookings.items, orders: orders.items, payments: payments.items, types: types.items };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const inRange = (d) => (d || '').slice(0, 10) >= from && (d || '').slice(0, 10) <= to;
    const orders = (data.orders || []).filter((o) => inRange(o.created_date || o.created_at) && o.status !== 'cancelled');
    const bookings = data.bookings || [];
    const payments = (data.payments || []).filter((p) => inRange(p.paid_at || p.created_date || p.created_at));
    const revenue = orders.reduce((s, o) => s + money(o.total), 0) + payments.reduce((s, p) => s + money(p.amount), 0);

    const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
    const capacity = (data.types || []).reduce((s, t) => s + (Number(t.total_rooms) || 0), 0) * days;
    const sold = bookings.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status)).reduce((s, b) => s + (Number(b.nights) || 0), 0);

    const series = [];
    for (let i = 0; i < days && i < 31; i += 1) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        revenue: orders.filter((o) => (o.created_date || o.created_at || '').startsWith(key)).reduce((s, o) => s + money(o.total), 0),
        orders: orders.filter((o) => (o.created_date || o.created_at || '').startsWith(key)).length,
      });
    }

    const bySource = {};
    bookings.forEach((b) => { bySource[b.source || 'website'] = (bySource[b.source || 'website'] || 0) + 1; });
    const byType = {};
    orders.forEach((o) => { byType[o.type || 'dine-in'] = (byType[o.type || 'dine-in'] || 0) + 1; });
    const dishes = {};
    orders.forEach((o) => (o.items || []).forEach((i) => { dishes[i.name] = (dishes[i.name] || 0) + Number(i.qty || 0); }));

    return {
      revenue,
      ordersCount: orders.length,
      bookingsCount: bookings.length,
      occupancy: capacity ? Math.round((sold / capacity) * 100) : 0,
      cancellations: bookings.filter((b) => b.status === 'cancelled').length,
      avgBooking: bookings.length ? Math.round(bookings.reduce((s, b) => s + money(b.amount), 0) / bookings.length) : 0,
      series,
      bySource: Object.entries(bySource).map(([label, value]) => ({ label, value })),
      byType: Object.entries(byType).map(([label, value]) => ({ label, value })),
      dishes: Object.entries(dishes).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    };
  }, [data, from, to]);

  const print = () => printHtml('Report', `
    <h1>Business report</h1><p class="muted">${from} → ${to}</p>
    <table>
      <tr><th>Revenue</th><td class="r">${inr(stats.revenue)}</td></tr>
      <tr><th>Orders</th><td class="r">${stats.ordersCount}</td></tr>
      <tr><th>Bookings</th><td class="r">${stats.bookingsCount}</td></tr>
      <tr><th>Occupancy</th><td class="r">${stats.occupancy}%</td></tr>
      <tr><th>Cancellations</th><td class="r">${stats.cancellations}</td></tr>
    </table>
    <h2>Top dishes</h2>
    <table>${stats.dishes.map((d) => `<tr><td>${d.label}</td><td class="r">${d.value}</td></tr>`).join('')}</table>
  `);

  const exportCsv = () => downloadCsv(`report-${from}-to-${to}.csv`, stats.series, [
    { label: 'Date', value: (r) => r.label },
    { label: 'Revenue', value: (r) => r.revenue },
    { label: 'Orders', value: (r) => r.orders },
  ]);

  if (isLoading || !stats) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />;

  const input = 'rounded-xl border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{L('Reports', 'रिपोर्ट')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"><Download size={15} />CSV</button>
          <button onClick={print} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><Printer size={15} />{L('Print / PDF', 'प्रिंट / PDF')}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        <label className="flex items-center gap-2">{L('From', 'से')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} /></label>
        <label className="flex items-center gap-2">{L('To', 'तक')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} /></label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [L('Revenue', 'आय'), inr(stats.revenue)],
          [L('Orders', 'ऑर्डर'), stats.ordersCount],
          [L('Bookings', 'बुकिंग'), stats.bookingsCount],
          [L('Occupancy', 'भराव'), `${stats.occupancy}%`],
          [L('Avg booking', 'औसत बुकिंग'), inr(stats.avgBooking)],
          [L('Cancellations', 'रद्द'), stats.cancellations],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">{L('Revenue by day', 'दिन-प्रतिदिन आय')}</h2>
        <RevenueChart data={stats.series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-2 font-semibold">{L('Bookings by source', 'स्रोत से बुकिंग')}</h2><BarList rows={stats.bySource} /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-2 font-semibold">{L('Orders by type', 'प्रकार से ऑर्डर')}</h2><BarList rows={stats.byType} /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2"><h2 className="mb-2 font-semibold">{L('Top dishes', 'टॉप डिश')}</h2><BarList rows={stats.dishes} /></div>
      </div>
    </div>
  );
}
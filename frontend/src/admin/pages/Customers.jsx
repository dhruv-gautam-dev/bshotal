import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { deriveCustomers, downloadCsv, inr } from '../lib/adminData';
import Empty from '../components/Empty';

export default function Customers() {
  const { L } = useI18n();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const [bookings, orders] = await Promise.all([
        base44.entities.Booking.filter({}, { sort: '-created_date', limit: 300 }),
        base44.entities.Order.filter({}, { sort: '-created_date', limit: 300 }),
      ]);
      return { bookings: bookings.items, orders: orders.items };
    },
  });

  const rows = useMemo(() => {
    const base = deriveCustomers(data?.bookings || [], data?.orders || []).map((c) => {
      const last = (data?.bookings || []).filter((b) => String(b.phone || '').endsWith(c.phone)).map((b) => b.check_in).sort().pop();
      return { ...c, last_visit: last || '' };
    });
    const term = q.trim().toLowerCase();
    return term ? base.filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term)) : base;
  }, [data, q]);

  const exportCsv = () => downloadCsv('customers.csv', rows, [
    { label: 'Name', value: (c) => c.name },
    { label: 'Phone', value: (c) => c.phone },
    { label: 'Bookings + orders', value: (c) => c.visits },
    { label: 'Total spend', value: (c) => c.total_spend },
    { label: 'Last stay', value: (c) => c.last_visit },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{L('Customers', 'ग्राहक')}</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Download size={16} />CSV</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search by name or phone', 'नाम या फ़ोन से खोजें')} className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm" />
      </div>

      <p className="text-xs text-slate-500">{L('Built automatically from bookings and orders.', 'बुकिंग और ऑर्डर से अपने आप बनाई गई सूची।')}</p>

      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" /> : rows.length === 0 ? (
        <Empty title={L('No customers yet', 'अभी कोई ग्राहक नहीं')} hint={L('Guests appear once they book a room or order food.', 'कमरा बुक करने या खाना ऑर्डर करने पर ग्राहक जुड़ेंगे।')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">{L('Customer', 'ग्राहक')}</th><th className="px-4 py-3 text-right">{L('Bookings + orders', 'बुकिंग + ऑर्डर')}</th><th className="px-4 py-3 text-right">{L('Total spend', 'कुल खर्च')}</th><th className="px-4 py-3">{L('Last stay', 'पिछला ठहराव')}</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.phone}>
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{c.name}</p><p className="text-xs text-slate-500">{c.phone}</p></td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.visits}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(c.total_spend)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.last_visit || '—'}</td>
                  <td className="px-4 py-3 text-right"><a href={`tel:+91${c.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><Phone size={13} />{L('Call', 'कॉल')}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
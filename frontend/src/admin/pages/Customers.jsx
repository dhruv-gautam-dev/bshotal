import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Phone, MessageSquare, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { deriveCustomers, downloadCsv, inr } from '../lib/adminData';
import Empty from '../components/Empty';

export default function Customers() {
  const { L } = useI18n();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const [bookings, orders, customersRes] = await Promise.all([
        apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 300 }),
        apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 300 }),
        apiClient.entities.Customer.list().catch(() => []),
      ]);
      const customerList = Array.isArray(customersRes) ? customersRes : (customersRes?.items || []);
      return {
        bookings: bookings.items || [],
        orders: orders.items || [],
        customers: customerList,
      };
    },
  });

  const rows = useMemo(() => {
    const dbCustomers = data?.customers || [];
    const dbCustByPhone = new Map();
    dbCustomers.forEach((c) => {
      const k = String(c.phone || '').replace(/\D/g, '').slice(-10);
      if (k) dbCustByPhone.set(k, c);
    });

    const derived = deriveCustomers(data?.bookings || [], data?.orders || []);

    const allPhones = new Set([...derived.map((c) => c.phone), ...dbCustByPhone.keys()]);
    const base = [...allPhones].map((phone) => {
      const d = derived.find((x) => x.phone === phone);
      const dbCust = dbCustByPhone.get(phone);
      const name = dbCust?.name || d?.name || 'Guest';
      const visits = d?.visits ?? (dbCust?.total_bookings_count || 0);
      const totalSpend = d?.total_spend ?? (Number(dbCust?.total_spent) || 0);
      const last = (data?.bookings || []).filter((b) => String(b.phone || '').endsWith(phone) && b.status !== 'failed').map((b) => b.check_in).sort().pop();
      const notes = dbCust?.notes || '';
      const hasFailed = d?.has_failed || Boolean(notes && notes.includes('failed_booking'));
      const failedNote = notes ? notes.split('\n').filter((l) => l.includes('failed_booking')).slice(-1)[0] : '';

      return {
        phone,
        name,
        visits,
        total_spend: totalSpend,
        last_visit: last || '',
        has_failed: hasFailed,
        notes,
        failed_note: failedNote,
      };
    });

    const term = q.trim().toLowerCase();
    return term
      ? base.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.phone.includes(term) ||
            c.notes.toLowerCase().includes(term)
        )
      : base;
  }, [data, q]);

  const exportCsv = () => downloadCsv('customers.csv', rows, [
    { label: 'Name', value: (c) => c.name },
    { label: 'Phone', value: (c) => c.phone },
    { label: 'Bookings + orders', value: (c) => c.visits },
    { label: 'Total spend', value: (c) => c.total_spend },
    { label: 'Last stay', value: (c) => c.last_visit },
    { label: 'Failed Booking Attempt', value: (c) => c.has_failed ? 'Yes' : 'No' },
    { label: 'Notes', value: (c) => c.notes || '' },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{L('Customers', 'ग्राहक')}</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"><Download size={16} />CSV</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search by name, phone or tag', 'नाम, फ़ोन या टैग से खोजें')} className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm" />
      </div>

      <p className="text-xs text-slate-500">{L('Built automatically from customer profiles, bookings, and orders.', 'ग्राहक प्रोफ़ाइल, बुकिंग और ऑर्डर से अपने आप बनाई गई सूची।')}</p>

      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" /> : rows.length === 0 ? (
        <Empty title={L('No customers yet', 'अभी कोई ग्राहक नहीं')} hint={L('Guests appear once they book a room, order food, or attempt booking.', 'कमरा बुक करने या खाना ऑर्डर करने पर ग्राहक जुड़ेंगे।')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">{L('Customer', 'ग्राहक')}</th>
                <th className="px-4 py-3 text-right">{L('Bookings + orders', 'बुकिंग + ऑर्डर')}</th>
                <th className="px-4 py-3 text-right">{L('Total spend', 'कुल खर्च')}</th>
                <th className="px-4 py-3">{L('Last stay', 'पिछला ठहराव')}</th>
                <th className="px-4 py-3 text-right">{L('Actions', 'कार्रवाई')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.phone} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      {c.has_failed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold border border-rose-200">
                          <AlertTriangle size={10} />
                          {L('Failed Booking Attempt', 'विफल बुकिंग प्रयास')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                    {c.failed_note && (
                      <p className="mt-1 text-[11px] text-amber-800 font-medium bg-amber-50 rounded px-1.5 py-0.5 inline-block border border-amber-200/60">
                        {c.failed_note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.visits}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(c.total_spend)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.last_visit || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <a
                      href={`tel:+91${c.phone}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                      <Phone size={12} className="text-emerald-600" />
                      {L('Call', 'कॉल')}
                    </a>
                    <a
                      href={`https://wa.me/91${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Namaste ${c.name}, thank you for contacting B.S. Hotel & Restaurant. How may we assist you today?`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 shadow-xs"
                    >
                      <MessageSquare size={12} />
                      WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { BOOKING_STATUS, inr, downloadCsv } from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Empty from '../components/Empty';
import BookingForm from '../components/BookingForm';

export default function Bookings() {
  const { L } = useI18n();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => { setOpen(params.get('new') === '1'); }, [params]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => (await apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 300 })).items,
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter((b) => {
      if (status && b.status !== status) return false;
      if (from && b.check_out < from) return false;
      if (to && b.check_in > to) return false;
      if (!term) return true;
      return [b.guest_name, b.phone, b.ref, b.room_type_name].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [bookings, q, status, from, to]);

  const closeForm = () => { setOpen(false); setParams({}); };
  const saved = () => qc.invalidateQueries({ queryKey: ['admin-bookings'] });

  const exportCsv = () => downloadCsv('bookings.csv', rows, [
    { label: 'Ref', value: (b) => b.ref },
    { label: 'Guest', value: (b) => b.guest_name },
    { label: 'Phone', value: (b) => b.phone },
    { label: 'Room type', value: (b) => b.room_type_name },
    { label: 'Check-in', value: (b) => b.check_in },
    { label: 'Check-out', value: (b) => b.check_out },
    { label: 'Status', value: (b) => b.status },
    { label: 'Amount', value: (b) => b.amount },
    { label: 'Advance', value: (b) => b.advance_paid },
    { label: 'Balance', value: (b) => b.balance },
  ]);

  const input = 'rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{L('Room bookings', 'कमरे की बुकिंग')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Download size={16} />CSV</button>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('New booking', 'नई बुकिंग')}</button>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Name, phone or ref', 'नाम, फ़ोन या रेफ')} className={`${input} w-full pl-9`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">{L('All statuses', 'सभी स्थिति')}</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-500">{L('From', 'से')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${input} w-full`} /></label>
        <label className="flex items-center gap-2 text-xs text-slate-500">{L('To', 'तक')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${input} w-full`} /></label>
        <p className="self-center text-xs text-slate-500">{rows.length} {L('results', 'परिणाम')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/60" />)}</div>
      ) : rows.length === 0 ? (
        <Empty title={L('No bookings yet', 'अभी कोई बुकिंग नहीं')} hint={L('Requests from the website and phone bookings appear here.', 'वेबसाइट से आई बुकिंग और फ़ोन बुकिंग यहाँ दिखेंगी।')} />
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{L('Guest', 'मेहमान')}</th>
                  <th className="px-4 py-3">{L('Stay', 'ठहराव')}</th>
                  <th className="px-4 py-3">{L('Room', 'कमरा')}</th>
                  <th className="px-4 py-3">{L('Status', 'स्थिति')}</th>
                  <th className="px-4 py-3 text-right">{L('Balance', 'बाकी')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.guest_name}</p>
                      <p className="text-xs text-slate-500">{b.phone} · {b.ref}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.check_in} → {b.check_out}<span className="block text-xs text-slate-400">{b.nights} {L('nights', 'रात')} · {b.guests} {L('guests', 'मेहमान')}</span></td>
                    <td className="px-4 py-3 text-slate-600">{b.room_type_name}</td>
                    <td className="px-4 py-3"><StatusPill kind="booking" value={b.status} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(b.balance)}</td>
                    <td className="px-4 py-3 text-right"><Link to={`/admin/bookings/${b.id}`} className="font-semibold text-amber-700">{L('Open', 'खोलें')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="space-y-2 lg:hidden">
            {rows.map((b) => (
              <button key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{b.guest_name}</p>
                    <p className="text-xs text-slate-500">{b.phone} · {b.ref}</p>
                  </div>
                  <StatusPill kind="booking" value={b.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{b.check_in} → {b.check_out} · {b.room_type_name}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{inr(b.amount)} <span className="text-xs font-normal text-slate-500">· {L('balance', 'बाकी')} {inr(b.balance)}</span></p>
              </button>
            ))}
          </div>
        </>
      )}

      <BookingForm open={open} onClose={closeForm} onSaved={saved} />
    </div>
  );
}
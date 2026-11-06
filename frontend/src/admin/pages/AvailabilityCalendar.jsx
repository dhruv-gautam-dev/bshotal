import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { BLOCKING } from '../lib/adminData';

const pad = (n) => String(n).padStart(2, '0');

/** Month grid: one row per room type, one cell per day. */
export default function AvailabilityCalendar({ roomTypes = [], bookings = [], blocks = [] }) {
  const { L } = useI18n();
  const safeRoomTypes = Array.isArray(roomTypes) ? roomTypes : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => {
    const iso = `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`;
    return { iso, n: i + 1, dow: new Date(cursor.y, cursor.m, i + 1).getDay() };
  }), [cursor, days]);

  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const cell = (type, iso) => {
    const booked = safeBookings.filter((b) => BLOCKING.includes(b?.status) && b?.room_type_id === type?.id && (b?.check_in || '') <= iso && (b?.check_out || '') > iso).length;
    const pending = safeBookings.filter((b) => b?.status === 'pending' && b?.room_type_id === type?.id && (b?.check_in || '') <= iso && (b?.check_out || '') > iso).length;
    const blocked = safeBlocks.filter((b) => !b?.room_id && b?.room_type_id === type?.id && (b?.start_date || '') <= iso && (b?.end_date || '') > iso).length;
    const total = Number(type?.total_rooms ?? type?.total_inventory) || 1;
    const free = total - booked - blocked;
    return { booked, pending, blocked, free, total };
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => move(-1)} className="rounded-lg border border-slate-200 p-2" aria-label="Previous month"><ChevronLeft size={16} /></button>
        <p className="font-semibold text-slate-900">{new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <button onClick={() => move(1)} className="rounded-lg border border-slate-200 p-2" aria-label="Next month"><ChevronRight size={16} /></button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold text-slate-500">{L('Room type', 'कमरा')}</th>
              {dayList.map((d) => (
                <th key={d.iso} className={`w-7 px-0 py-1 text-center font-medium ${d.dow === 0 ? 'text-red-500' : 'text-slate-500'}`}>{d.n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {safeRoomTypes.map((t) => (
              <tr key={t.id}>
                <td className="sticky left-0 z-10 max-w-[130px] truncate bg-white px-2 py-1 font-medium text-slate-700">{t.name_en}</td>
                {dayList.map((d) => {
                  const c = cell(t, d.iso);
                  const tone = c.free <= 0 ? 'bg-red-100 text-red-700' : c.free < c.total ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700';
                  return (
                    <td key={d.iso} className={`border border-white p-0 text-center ${tone}`} title={`${t.name_en} · ${d.iso} · ${c.free}/${c.total} ${L('free', 'खाली')}${c.pending > 0 ? ` (${c.pending} ${L('pending request', 'अनुरोध लंबित')})` : ''}`}>
                      <span className="relative block py-1.5 text-[10px] font-semibold">
                        {c.free > 0 ? c.free : '·'}
                        {c.pending > 0 && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-100" /> {L('Free', 'खाली')}</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-amber-100" /> {L('Partly booked', 'कुछ भरे')}</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-red-100" /> {L('Full / blocked', 'पूरा भरा')}</span>
      </div>
    </div>
  );
}
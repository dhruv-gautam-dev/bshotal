import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Phone, MessageCircle, ExternalLink, Calendar, BedDouble, User } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { BLOCKING, inr } from '../lib/adminData';
import StatusPill from '../components/StatusPill';

const pad = (n) => String(n).padStart(2, '0');

/** Month grid: one row per room type, one cell per day with guest booking details below. */
export default function AvailabilityCalendar({ roomTypes = [], bookings = [], blocks = [] }) {
  const { L } = useI18n();
  const safeRoomTypes = Array.isArray(roomTypes) ? roomTypes : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => {
    const iso = `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`;
    return { iso, n: i + 1, dow: new Date(cursor.y, cursor.m, i + 1).getDay() };
  }), [cursor, days]);

  const monthLabel = useMemo(() => {
    return new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [cursor]);

  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelectedDate(null);
  };

  const cell = (type, iso) => {
    const booked = safeBookings.filter((b) => BLOCKING.includes(b?.status) && b?.room_type_id === type?.id && (b?.check_in || '') <= iso && (b?.check_out || '') > iso).length;
    const pending = safeBookings.filter((b) => b?.status === 'pending' && b?.room_type_id === type?.id && (b?.check_in || '') <= iso && (b?.check_out || '') > iso).length;
    const blocked = safeBlocks.filter((b) => !b?.room_id && b?.room_type_id === type?.id && (b?.start_date || '') <= iso && (b?.end_date || '') > iso).length;
    const total = Number(type?.total_rooms ?? type?.total_inventory) || 1;
    const free = total - booked - blocked;
    return { booked, pending, blocked, free, total };
  };

  // Filter booked rooms for details display
  const monthStart = `${cursor.y}-${pad(cursor.m + 1)}-01`;
  const monthEnd = `${cursor.y}-${pad(cursor.m + 1)}-${pad(days)}`;

  const activeBookings = useMemo(() => {
    return safeBookings.filter((b) => {
      // Must be confirmed, checked_in, or pending
      if (!['confirmed', 'checked_in', 'pending'].includes(b?.status)) return false;
      if (statusFilter && b?.status !== statusFilter) return false;
      if (selectedTypeId && b?.room_type_id !== selectedTypeId) return false;

      // Filter by selected single date or current month
      if (selectedDate) {
        return (b?.check_in || '') <= selectedDate && (b?.check_out || '') > selectedDate;
      }
      return (b?.check_out || '') >= monthStart && (b?.check_in || '') <= monthEnd;
    }).sort((a, b) => (a.check_in || '').localeCompare(b.check_in || ''));
  }, [safeBookings, selectedDate, selectedTypeId, statusFilter, monthStart, monthEnd]);

  return (
    <div className="space-y-4">
      {/* Calendar Grid Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <p className="font-semibold text-slate-900">{monthLabel}</p>
            <button onClick={() => move(1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          {selectedDate && (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {L('Filtered by date:', 'चुनी गई तारीख:')} {selectedDate}
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {L('View full month', 'पूरा महीना देखें')}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold text-slate-500">{L('Room type', 'कमरा')}</th>
                {dayList.map((d) => (
                  <th
                    key={d.iso}
                    onClick={() => setSelectedDate(d.iso === selectedDate ? null : d.iso)}
                    className={`w-7 cursor-pointer px-0 py-1 text-center font-medium transition hover:bg-slate-100 ${d.iso === selectedDate ? 'bg-amber-200 text-amber-900 font-bold' : d.dow === 0 ? 'text-red-500' : 'text-slate-500'}`}
                    title={`Click to filter bookings for ${d.iso}`}
                  >
                    {d.n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeRoomTypes.map((t) => (
                <tr key={t.id}>
                  <td
                    onClick={() => setSelectedTypeId(selectedTypeId === t.id ? '' : t.id)}
                    className={`sticky left-0 z-10 max-w-[130px] cursor-pointer truncate px-2 py-1.5 font-medium transition hover:text-amber-600 ${selectedTypeId === t.id ? 'bg-amber-50 text-amber-800 font-bold' : 'bg-white text-slate-700'}`}
                    title="Click to filter by this room type"
                  >
                    {t.name_en}
                  </td>
                  {dayList.map((d) => {
                    const c = cell(t, d.iso);
                    const isSelected = selectedDate === d.iso;
                    const tone = c.free <= 0 ? 'bg-red-100 text-red-700' : c.free < c.total ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700';
                    return (
                      <td
                        key={d.iso}
                        onClick={() => {
                          setSelectedDate(d.iso);
                          setSelectedTypeId(t.id);
                        }}
                        className={`cursor-pointer border border-white p-0 text-center transition hover:ring-2 hover:ring-amber-400 ${tone} ${isSelected ? 'ring-2 ring-slate-900' : ''}`}
                        title={`${t.name_en} · ${d.iso} · ${c.free}/${c.total} ${L('free', 'खाली')}${c.pending > 0 ? ` (${c.pending} ${L('pending request', 'अनुरोध लंबित')})` : ''} · Click to see booked guests`}
                      >
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-emerald-100" /> {L('Free', 'खाली')}</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-amber-100" /> {L('Partly booked', 'कुछ भरे')}</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-red-100" /> {L('Full / blocked', 'पूरा भरा')}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> {L('Pending request', 'अनुरोध')}</span>
          </div>
          <span className="text-slate-400">{L('Click any day to see who booked rooms on that date', 'किसी भी दिन पर क्लिक करके देखें कौन से मेहमान ठहरे हैं')}</span>
        </div>
      </div>

      {/* Booked Rooms & Guest Details Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <BedDouble size={18} className="text-amber-600" />
              {L('Booked Rooms & Guest Details', 'बुक किए गए कमरे और मेहमान विवरण')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedDate ? (
                <span>{L('Showing rooms booked on', 'इस तारीख को बुक कमरे:')} <b>{selectedDate}</b> ({activeBookings.length} {L('bookings', 'बुकिंग')})</span>
              ) : (
                <span>{L('Showing all active bookings for', 'इस महीने की सभी सक्रिय बुकिंग:')} <b>{monthLabel}</b> ({activeBookings.length} {L('bookings', 'बुकिंग')})</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none"
            >
              <option value="">{L('All Statuses', 'सभी स्थिति')}</option>
              <option value="confirmed">{L('Confirmed', 'कन्फ़र्म')}</option>
              <option value="checked_in">{L('Checked In', 'चेक-इन')}</option>
              <option value="pending">{L('Pending Requests', 'लंबित अनुरोध')}</option>
            </select>

            {selectedTypeId && (
              <button
                onClick={() => setSelectedTypeId('')}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                {safeRoomTypes.find((t) => t.id === selectedTypeId)?.name_en || 'Type'} ✕
              </button>
            )}

            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
              >
                {selectedDate} ✕
              </button>
            )}
          </div>
        </div>

        {activeBookings.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <Calendar size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-700">
              {selectedDate
                ? L(`No rooms are booked for ${selectedDate}.`, `${selectedDate} को कोई कमरा बुक नहीं है।`)
                : L('No active bookings in this period.', 'इस अवधि में कोई बुकिंग नहीं है।')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {L('When guests book rooms, their full contact and stay details will appear here.', 'मेहमानों द्वारा कमरा बुक करने पर उनका पूरा विवरण यहाँ दिखाई देगा।')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 mt-3 shadow-xs">
            <table className="w-full min-w-[850px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">#Ref</th>
                  <th className="px-4 py-3 text-left">{L('Guest details', 'मेहमान विवरण')}</th>
                  <th className="px-4 py-3 text-left">{L('Room & Category', 'कमरा व प्रकार')}</th>
                  <th className="px-4 py-3 text-left">{L('Stay dates', 'ठहराव तारीखें')}</th>
                  <th className="px-4 py-3 text-left">{L('Status', 'स्थिति')}</th>
                  <th className="px-4 py-3 text-right">{L('Payment (₹)', 'भुगतान (₹)')}</th>
                  <th className="px-4 py-3 text-right">{L('Actions & Contact', 'संपर्क व कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeBookings.map((b) => {
                  const waUrl = `https://wa.me/91${b.phone}?text=${encodeURIComponent(`Namaste ${b.guest_name}, this is B.S. Hotel regarding your booking #${b.ref}.`)}`;

                  return (
                    <tr key={b.id} className="transition hover:bg-slate-50/80">
                      {/* Booking Ref */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap align-middle">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px]">
                          #{b.ref}
                        </span>
                      </td>

                      {/* Guest */}
                      <td className="px-4 py-3 whitespace-nowrap align-middle">
                        <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          {b.guest_name}
                        </p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{b.phone}</p>
                      </td>

                      {/* Room & Category */}
                      <td className="px-4 py-3 whitespace-nowrap align-middle">
                        <p className="font-medium text-slate-800 flex items-center gap-1">
                          <BedDouble size={13} className="text-amber-700" />
                          {b.room_type_name || 'Standard Room'}
                        </p>
                        <div className="mt-0.5">
                          {b.room_number ? (
                            <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              {L('Room', 'कमरा')} {b.room_number}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                              {L('Room pending', 'कमरा आवंटित नहीं')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stay Dates */}
                      <td className="px-4 py-3 whitespace-nowrap align-middle text-slate-700">
                        <p className="font-semibold text-slate-900">{b.check_in} → {b.check_out}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {b.nights || 1} {L('night(s)', 'रात')} · {b.guests || 1} {L('guest(s)', 'मेहमान')}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap align-middle">
                        <StatusPill kind="booking" value={b.status} />
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
                        <p className="font-bold text-slate-900">{inr(b.amount)}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {L('Paid:', 'जमा:')} <span className="text-emerald-700 font-medium">{inr(b.advance_paid)}</span> · {L('Bal:', 'बाकी:')} <span className="text-amber-700 font-bold">{inr(b.balance)}</span>
                        </p>
                      </td>

                      {/* Actions & Contact */}
                      <td className="px-4 py-3 text-right whitespace-nowrap align-middle">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <a
                            href={`tel:+91${b.phone}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            title={`Call ${b.phone}`}
                          >
                            <Phone size={12} />
                            <span className="hidden xl:inline">{b.phone}</span>
                          </a>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                            title="WhatsApp"
                          >
                            <MessageCircle size={12} />
                            <span className="hidden md:inline">WhatsApp</span>
                          </a>
                          <Link
                            to={`/admin/bookings/${b.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            title="Open booking"
                          >
                            <span>{L('Details', 'विवरण')}</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
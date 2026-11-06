import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, X, AlertTriangle, CheckCircle2, BedDouble, Calendar, User, Phone } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { BOOKING_STATUS, inr, downloadCsv } from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Empty from '../components/Empty';
import BookingForm from '../components/BookingForm';
import DatePicker from '@/components/ui/date-picker';

export default function Bookings() {
  const { L } = useI18n();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Confirmation modal state with live inventory guard & room number assignment
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    booking: null,
    loading: false,
    error: '',
    data: null,
    selectedRoomId: '',
    submitting: false,
  });

  useEffect(() => { setOpen(params.get('new') === '1'); }, [params]);

  const { data: rawBookings = [], isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      try {
        const res = await apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 100 });
        return Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Failed to load admin bookings:', err);
        return [];
      }
    },
    refetchInterval: 6000,
  });

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['admin-room-types'],
    queryFn: async () => {
      return await apiClient.entities.RoomType.list().catch(() => []);
    },
  });

  const bookings = Array.isArray(rawBookings) ? rawBookings : [];

  const hasActiveFilters = Boolean(q || status || roomTypeId || from || to);
  const clearFilters = () => {
    setQ('');
    setStatus('');
    setRoomTypeId('');
    setFrom('');
    setTo('');
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter((b) => {
      if (status && b.status !== status) return false;
      if (roomTypeId && b.room_type_id !== roomTypeId) return false;
      if (from && b.check_out < from) return false;
      if (to && b.check_in > to) return false;
      if (!term) return true;
      return [b.guest_name, b.phone, b.ref, b.room_type_name, b.room_number].some((v) =>
        String(v || '').toLowerCase().includes(term)
      );
    });
  }, [bookings, q, status, roomTypeId, from, to]);

  const closeForm = () => { setOpen(false); setParams({}); };
  const saved = () => qc.invalidateQueries({ queryKey: ['admin-bookings'] });

  const openConfirmModal = async (e, booking) => {
    e?.stopPropagation?.();
    setConfirmModal({
      open: true,
      booking,
      loading: true,
      error: '',
      data: null,
      selectedRoomId: booking.room_id || '',
      submitting: false,
    });

    try {
      const res = await apiClient.entities.Room.getAvailableForDates({
        roomTypeId: booking.room_type_id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        excludeBookingId: booking.id,
      });

      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
        data: res,
        selectedRoomId: booking.room_id || (res.available_rooms?.[0]?.id || ''),
      }));
    } catch (err) {
      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Could not check room availability',
      }));
    }
  };

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    const b = confirmModal.booking;
    if (!b) return;

    if (confirmModal.data && (!confirmModal.data.is_available || confirmModal.data.available_count <= 0)) {
      alert(L(
        `Cannot confirm booking: ${confirmModal.data.room_type_name} is fully booked for ${b.check_in} to ${b.check_out}. No rooms are available for these dates.`,
        `बुकिंग कन्फ़र्म नहीं हो सकती: ${confirmModal.data.room_type_name} इन तारीखों (${b.check_in} से ${b.check_out}) में पूरी तरह बुक है। कोई कमरा खाली नहीं है।`
      ));
      return;
    }

    setConfirmModal((prev) => ({ ...prev, submitting: true, error: '' }));

    try {
      await apiClient.entities.Booking.update(b.id, {
        status: 'confirmed',
        assigned_room_id: confirmModal.selectedRoomId || undefined,
      });
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      qc.invalidateQueries({ queryKey: ['admin-rooms'] });
      setConfirmModal({
        open: false,
        booking: null,
        loading: false,
        error: '',
        data: null,
        selectedRoomId: '',
        submitting: false,
      });
    } catch (err) {
      setConfirmModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Failed to confirm booking',
      }));
    }
  };

  const exportCsv = () => downloadCsv('bookings.csv', rows, [
    { label: 'Ref', value: (b) => b.ref },
    { label: 'Guest', value: (b) => b.guest_name },
    { label: 'Phone', value: (b) => b.phone },
    { label: 'Room type', value: (b) => b.room_type_name },
    { label: 'Room number', value: (b) => b.room_number || '' },
    { label: 'Check-in', value: (b) => b.check_in },
    { label: 'Check-out', value: (b) => b.check_out },
    { label: 'Status', value: (b) => b.status },
    { label: 'Amount', value: (b) => b.amount },
    { label: 'Advance', value: (b) => b.advance_paid },
    { label: 'Balance', value: (b) => b.balance },
  ]);

  const inputClass = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{L('Room bookings', 'कमरे की बुकिंग')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download size={16} />CSV</button>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} />{L('New booking', 'नई बुकिंग')}</button>
        </div>
      </div>

      {/* Responsive, Clean Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">
            {L('Filter bookings', 'फ़िल्टर')} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-800">{rows.length} {L('found', 'मिले')}</span>
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800"
            >
              <X size={13} />
              {L('Reset all filters', 'फ़िल्टर हटाएं')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Search */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L('Search', 'खोजें')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L('Name, phone or ref', 'नाम, फ़ोन या रेफ़')}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L('Status', 'स्थिति')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">{L('All statuses', 'सभी स्थिति')}</option>
              {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
            </select>
          </div>

          {/* Room Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L('Room Category', 'कमरे का प्रकार')}</label>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass}>
              <option value="">{L('All categories', 'सभी प्रकार')}</option>
              {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name_en || rt.name}</option>)}
            </select>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L('Check-in from', 'से चेक-इन')}</label>
            <DatePicker
              variant="admin"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={L('From date', 'शुरुआती तारीख')}
              className="h-10 py-1.5"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{L('Check-out until', 'तक चेक-आउट')}</label>
            <DatePicker
              variant="admin"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              placeholder={L('To date', 'अंतिम तारीख')}
              className="h-10 py-1.5"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/60" />)}</div>
      ) : rows.length === 0 ? (
        <Empty title={L('No bookings found', 'कोई बुकिंग नहीं मिली')} hint={L('Try adjusting your search filters or create a new booking.', 'फ़िल्टर बदलें या नई बुकिंग बनाएं।')} />
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">{L('Guest', 'मेहमान')}</th>
                  <th className="px-4 py-3">{L('Stay dates', 'ठहराव तारीखें')}</th>
                  <th className="px-4 py-3">{L('Room & Category', 'कमरा व प्रकार')}</th>
                  <th className="px-4 py-3">{L('Status', 'स्थिति')}</th>
                  <th className="px-4 py-3 text-right">{L('Amount & Balance', 'राशि व बाकी')}</th>
                  <th className="px-4 py-3 text-right">{L('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{b.guest_name}</p>
                      <p className="text-xs text-slate-500">{b.phone} · <span className="font-mono text-[11px]">#{b.ref}</span></p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-800">{b.check_in} → {b.check_out}</p>
                      <span className="text-xs text-slate-400">{b.nights} {L('nights', 'रात')} · {b.guests} {L('guests', 'मेहमान')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{b.room_type_name}</p>
                      {b.room_number ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {L('Room', 'कमरा')} {b.room_number}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">
                          {L('Room not assigned', 'कमरा नंबर तय नहीं')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusPill kind="booking" value={b.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-slate-900 tabular-nums">{inr(b.amount)}</p>
                      <p className="text-xs text-amber-700 font-medium">{L('Bal:', 'बाकी:')} {inr(b.balance)}</p>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {b.status === 'pending' && (
                        <button
                          type="button"
                          onClick={(e) => openConfirmModal(e, b)}
                          className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          {L('Confirm…', 'कन्फ़र्म…')}
                        </button>
                      )}
                      <Link
                        to={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {L('Open', 'खोलें')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((b) => (
              <div key={b.id} className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{b.guest_name}</p>
                    <p className="text-xs text-slate-500">{b.phone} · #{b.ref}</p>
                  </div>
                  <StatusPill kind="booking" value={b.status} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-xs border-y border-slate-100 py-2">
                  <div>
                    <p className="text-slate-500">{b.check_in} → {b.check_out} ({b.nights} {L('nights', 'रात')})</p>
                    <p className="font-medium text-slate-800">{b.room_type_name}{b.room_number ? ` · Room ${b.room_number}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{inr(b.amount)}</p>
                    <p className="text-amber-700 font-medium">{L('Bal:', 'बाकी:')} {inr(b.balance)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {b.status === 'pending' && (
                    <button
                      type="button"
                      onClick={(e) => openConfirmModal(e, b)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {L('Confirm…', 'कन्फ़र्म…')}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/admin/bookings/${b.id}`)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {L('Details', 'विवरण')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirmation Modal with Availability Validation and Room Number Selection */}
      {confirmModal.open && confirmModal.booking && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmSubmit}
            className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-base">{L('Confirm Booking Request', 'बुकिंग अनुरोध कन्फ़र्म करें')}</h2>
                <p className="text-xs text-slate-500 font-mono">#{confirmModal.booking.ref}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Booking Details Card */}
            <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{L('Guest:', 'मेहमान:')}</span>
                <span className="font-semibold text-slate-900">{confirmModal.booking.guest_name} ({confirmModal.booking.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{L('Category:', 'प्रकार:')}</span>
                <span className="font-semibold text-slate-900">{confirmModal.booking.room_type_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{L('Dates:', 'तारीखें:')}</span>
                <span className="font-semibold text-slate-900">{confirmModal.booking.check_in} → {confirmModal.booking.check_out} ({confirmModal.booking.nights} {L('nights', 'रात')})</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1">
                <span className="text-slate-500">{L('Total amount:', 'कुल राशि:')}</span>
                <span className="font-bold text-slate-900">{inr(confirmModal.booking.amount)}</span>
              </div>
            </div>

            {confirmModal.loading ? (
              <div className="py-6 text-center text-xs text-slate-500 animate-pulse">
                {L('Checking real-time room availability…', 'उपलब्धता जाँची जा रही है…')}
              </div>
            ) : confirmModal.data && (!confirmModal.data.is_available || confirmModal.data.available_count <= 0) ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-2 text-xs text-red-800">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <AlertTriangle size={16} className="text-red-600" />
                  {L('No Rooms Available for These Dates', 'इन तारीखों में कोई कमरा उपलब्ध नहीं')}
                </div>
                <p>
                  {L(
                    `All rooms in "${confirmModal.data.room_type_name}" are already fully booked from ${confirmModal.booking.check_in} to ${confirmModal.booking.check_out}. Only ${confirmModal.data.available_count} room(s) available.`,
                    `"${confirmModal.data.room_type_name}" श्रेणी के सभी कमरे ${confirmModal.booking.check_in} से ${confirmModal.booking.check_out} तक भरे हुए हैं। केवल ${confirmModal.data.available_count} कमरा उपलब्ध है।`
                  )}
                </p>
                <p className="font-medium text-red-900">
                  {L('You cannot confirm this booking on these dates.', 'आप इन तारीखों पर यह बुकिंग कन्फ़र्म नहीं कर सकते।')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>
                    {L('Rooms available for these dates:', 'इन तारीखों पर कमरे उपलब्ध हैं:')}{' '}
                    <b>{confirmModal.data?.available_count ?? 1} {L('vacant', 'खाली')}</b>
                  </span>
                </div>

                {/* Room Number Assignment */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {L('Assign Room Number', 'कमरा नंबर आवंटित करें')}
                  </label>
                  {confirmModal.data?.available_rooms && confirmModal.data.available_rooms.length > 0 ? (
                    <select
                      value={confirmModal.selectedRoomId}
                      onChange={(e) => setConfirmModal((prev) => ({ ...prev, selectedRoomId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">{L('-- Select Available Room Number --', '-- खाली कमरा नंबर चुनें --')}</option>
                      {confirmModal.data.available_rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {L('Room', 'कमरा')} {r.room_number} {r.floor ? `(Floor ${r.floor})` : ''} · {r.status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                      {L(
                        'No physical room numbers configured yet for this category. Booking will be confirmed against category inventory.',
                        'इस श्रेणी के लिए अभी विशिष्ट कमरा नंबर नहीं बने हैं। बुकिंग श्रेणी क्षमता के तहत कन्फ़र्म की जाएगी।'
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {L('Only displays room numbers that are vacant for the full stay duration.', 'केवल वही कमरा नंबर दिखाए जा रहे हैं जो पूरी अवधि के लिए खाली हैं।')}
                  </p>
                </div>
              </div>
            )}

            {confirmModal.error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
                {confirmModal.error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {L('Cancel', 'रद्द')}
              </button>
              <button
                type="submit"
                disabled={
                  confirmModal.submitting ||
                  confirmModal.loading ||
                  (confirmModal.data && (!confirmModal.data.is_available || confirmModal.data.available_count <= 0))
                }
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirmModal.submitting ? L('Confirming…', 'कन्फ़र्म हो रहा है…') : L('Confirm Booking', 'बुकिंग कन्फ़र्म करें')}
              </button>
            </div>
          </form>
        </div>
      )}

      <BookingForm open={open} onClose={closeForm} onSaved={saved} />
    </div>
  );
}

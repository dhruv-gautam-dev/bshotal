import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { Plus, Search, Download, X, AlertTriangle, CheckCircle2, BedDouble, Calendar, User, Phone, MessageSquare, SlidersHorizontal, ChevronDown, Eye, ShieldCheck, ExternalLink } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { BOOKING_STATUS, inr, downloadCsv } from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Empty from '../components/Empty';
import BookingForm from '../components/BookingForm';
import DatePicker from '@/components/ui/date-picker';
import {
  setBookingsData,
  updateBookingOptimistic,
} from '@/store/slices/bookingsSlice';
import { updateRoomOptimistic } from '@/store/slices/roomsSlice';

export default function Bookings() {
  const { L } = useI18n();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [subTab, setSubTab] = useState(params.get('tab') === 'failed' ? 'failed' : 'all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const reduxBookings = useSelector((state) => state.bookings.items);
  const isBookingsLoaded = useSelector((state) => state.bookings.isLoaded);

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

  const [screenshotModal, setScreenshotModal] = useState(null);

  const getScreenshot = (b) => {
    if (!b) return null;
    if (b.payment_screenshot) return b.payment_screenshot;
    const match = String(b.special_requests || b.admin_notes || '').match(/\[PAYMENT_SCREENSHOT:\s*(data:image\/[^\]\s]+)\]/);
    return match ? match[1] : null;
  };

  useEffect(() => { setOpen(params.get('new') === '1'); }, [params]);

  const { data: rawBookings = [], isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      try {
        const res = await apiClient.entities.Booking.filter({}, { sort: '-created_date', limit: 100 });
        const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        dispatch(setBookingsData(list));
        return list;
      } catch (err) {
        console.error('Failed to load admin bookings:', err);
        return [];
      }
    },
    refetchInterval: 6000,
  });

  useEffect(() => {
    if (Array.isArray(rawBookings) && rawBookings.length > 0) {
      dispatch(setBookingsData(rawBookings));
    }
  }, [rawBookings, dispatch]);

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['admin-room-types'],
    queryFn: async () => {
      return await apiClient.entities.RoomType.list().catch(() => []);
    },
  });

  const bookings = isBookingsLoaded ? reduxBookings : (Array.isArray(rawBookings) ? rawBookings : []);

  const failedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'failed' || b.booking_status === 'failed');
  }, [bookings]);

  const regularBookings = useMemo(() => {
    return bookings.filter((b) => b.status !== 'failed' && b.booking_status !== 'failed');
  }, [bookings]);

  const hasActiveFilters = Boolean(q || status || roomTypeId || from || to);
  const activeNonSearchFiltersCount = [status, roomTypeId, from, to].filter(Boolean).length;
  const hasNonSearchFilters = activeNonSearchFiltersCount > 0;
  const clearFilters = () => {
    setQ('');
    setStatus('');
    setRoomTypeId('');
    setFrom('');
    setTo('');
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sourceList = subTab === 'failed' ? failedBookings : regularBookings;
    return sourceList.filter((b) => {
      if (status && b.status !== status) return false;
      if (roomTypeId && b.room_type_id !== roomTypeId) return false;
      if (from && b.check_out < from) return false;
      if (to && b.check_in > to) return false;
      if (!term) return true;
      return [
        b.guest_name,
        b.phone,
        b.ref,
        b.room_type_name,
        b.room_number,
        b.cancellation_reason,
        b.admin_notes,
      ].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [subTab, failedBookings, regularBookings, q, status, roomTypeId, from, to]);

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
      const availText = confirmModal.data.available_dates_formatted
        ? ` (${L('Available only for dates: ', 'केवल इन तारीखों पर उपलब्ध: ')} ${confirmModal.data.available_dates_formatted})`
        : '';
      alert(L(
        `Cannot confirm booking: ${confirmModal.data.room_type_name} is not available for ${b.check_in} to ${b.check_out}.${availText}`,
        `बुकिंग कन्फ़र्म नहीं हो सकती: ${confirmModal.data.room_type_name} इन तारीखों (${b.check_in} से ${b.check_out}) में उपलब्ध नहीं है।${availText}`
      ));
      return;
    }

    const assignedRoomId = confirmModal.selectedRoomId || undefined;
    const assignedRoomObj = confirmModal.data?.available_rooms?.find((r) => r.id === assignedRoomId);
    const assignedRoomNumber = assignedRoomObj ? assignedRoomObj.room_number : b.room_number;

    // 1. INSTANT OPTIMISTIC UPDATE: Update Redux state immediately!
    dispatch(updateBookingOptimistic({
      id: b.id,
      status: 'confirmed',
      booking_status: 'confirmed',
      assigned_room_id: assignedRoomId,
      room_id: assignedRoomId,
      room_number: assignedRoomNumber,
    }));
    if (assignedRoomId) {
      dispatch(updateRoomOptimistic({ id: assignedRoomId, status: 'occupied' }));
    }

    // Close modal immediately
    setConfirmModal({
      open: false,
      booking: null,
      loading: false,
      error: '',
      data: null,
      selectedRoomId: '',
      submitting: false,
    });

    try {
      await apiClient.entities.Booking.update(b.id, {
        status: 'confirmed',
        assigned_room_id: assignedRoomId,
      });
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      qc.invalidateQueries({ queryKey: ['admin-rooms'] });
    } catch (err) {
      alert(err.message || 'Failed to confirm booking');
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    }
  };

  const exportCsv = () => {
    if (subTab === 'failed') {
      return downloadCsv('failed_bookings.csv', rows, [
        { label: 'Ref', value: (b) => b.ref },
        { label: 'Guest', value: (b) => b.guest_name },
        { label: 'Phone', value: (b) => b.phone },
        { label: 'Room Category', value: (b) => b.room_type_name },
        { label: 'Check-in', value: (b) => b.check_in },
        { label: 'Check-out', value: (b) => b.check_out },
        { label: 'Guests', value: (b) => b.guests },
        { label: 'Status', value: () => 'Unavailable / Failed' },
        { label: 'Unavailability Reason & Dates', value: (b) => b.cancellation_reason || b.admin_notes || '' },
        { label: 'Attempt Time', value: (b) => b.created_date || '' },
      ]);
    }
    return downloadCsv('bookings.csv', rows, [
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
  };

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

      {/* Sub-Tabs: All Bookings vs Failed Bookings */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setSubTab('all');
            if (status === 'failed') setStatus('');
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BedDouble size={16} />
          {L('All Bookings', 'सभी बुकिंग')}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              subTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {regularBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('failed');
            if (status !== 'failed') setStatus('');
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === 'failed'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
          }`}
        >
          <AlertTriangle size={16} />
          {L('Failed Bookings', 'विफल बुकिंग')}
          {failedBookings.length > 0 && (
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                subTab === 'failed' ? 'bg-rose-800 text-rose-100' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {failedBookings.length}
            </span>
          )}
        </button>
      </div>

      {/* Responsive, Clean Filter Bar with Mobile Collapsible Dropdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
        {/* Desktop Header Summary */}
        <div className="hidden lg:flex items-center justify-between text-xs">
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

        {/* Mobile View: Search Bar Outside + Collapsible Filters Dropdown */}
        <div className="lg:hidden space-y-2.5">
          <div className="flex items-center gap-2">
            {/* Search Input stays directly outside */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L('Search name, phone, ref...', 'नाम, फ़ोन, रेफ़ खोजें...')}
                className={`${inputClass} pl-9 pr-8 text-xs`}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Mobile Filters Dropdown Toggle Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition shrink-0 ${
                hasNonSearchFilters
                  ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-xs'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>{L('Filters', 'फ़िल्टर')}</span>
              {activeNonSearchFiltersCount > 0 && (
                <span className="rounded-full bg-amber-700 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeNonSearchFiltersCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform duration-200 ${showMobileFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Active filter pills on mobile when collapsed */}
          {!showMobileFilters && hasNonSearchFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              {status && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 font-medium text-amber-900 border border-amber-200">
                  {BOOKING_STATUS[status]?.en || status}
                  <button onClick={() => setStatus('')}><X size={11} /></button>
                </span>
              )}
              {roomTypeId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
                  {roomTypes.find((r) => r.id === roomTypeId)?.name_en || L('Category', 'श्रेणी')}
                  <button onClick={() => setRoomTypeId('')}><X size={11} /></button>
                </span>
              )}
              {(from || to) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
                  {from ? from : ''} → {to ? to : ''}
                  <button onClick={() => { setFrom(''); setTo(''); }}><X size={11} /></button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-amber-800 underline font-semibold text-[11px] ml-1"
              >
                {L('Clear all', 'सभी हटाएं')}
              </button>
            </div>
          )}

          {/* Collapsible Filters Dropdown / Accordion for Mobile */}
          {showMobileFilters && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {L('Filter Options', 'फ़िल्टर विकल्प')}
                </span>
                {hasNonSearchFilters && (
                  <button
                    type="button"
                    onClick={() => { setStatus(''); setRoomTypeId(''); setFrom(''); setTo(''); }}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    {L('Reset', 'रीसेट')}
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {L('Status', 'स्थिति')}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                  disabled={subTab === 'failed'}
                >
                  <option value="">{subTab === 'failed' ? L('Unavailable / Failed', 'अनुपलब्ध / विफल') : L('All statuses', 'सभी स्थिति')}</option>
                  {subTab !== 'failed' && Object.entries(BOOKING_STATUS).filter(([k]) => k !== 'failed').map(([k, v]) => (
                    <option key={k} value={k}>{L(v.en, v.hi)}</option>
                  ))}
                </select>
              </div>

              {/* Room Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {L('Room Category', 'कमरे का प्रकार')}
                </label>
                <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass}>
                  <option value="">{L('All categories', 'सभी प्रकार')}</option>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name_en || rt.name}</option>)}
                </select>
              </div>

              {/* Date Filters: From & To */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {L('Check-in from', 'से चेक-इन')}
                  </label>
                  <DatePicker
                    variant="admin"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder={L('From', 'शुरुआती')}
                    className="h-10 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {L('Check-out to', 'तक चेक-आउट')}
                  </label>
                  <DatePicker
                    variant="admin"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    min={from}
                    placeholder={L('Until', 'अंतिम')}
                    className="h-10 py-1.5"
                  />
                </div>
              </div>

              {/* Done button */}
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition mt-2"
              >
                {L('Done / View Results', 'लागू करें / परिणाम देखें')} ({rows.length})
              </button>
            </div>
          )}
        </div>

        {/* Desktop View: Full 5-Column Grid */}
        <div className="hidden lg:grid grid-cols-5 gap-3">
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
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
              disabled={subTab === 'failed'}
            >
              <option value="">{subTab === 'failed' ? L('Unavailable / Failed', 'अनुपलब्ध / विफल') : L('All statuses', 'सभी स्थिति')}</option>
              {subTab !== 'failed' && Object.entries(BOOKING_STATUS).filter(([k]) => k !== 'failed').map(([k, v]) => (
                <option key={k} value={k}>{L(v.en, v.hi)}</option>
              ))}
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
        subTab === 'failed' ? (
          <Empty
            title={L('No failed bookings found', 'कोई विफल बुकिंग नहीं मिली')}
            hint={L('When online bookings fail due to room unavailability, guest contact details and requested dates will be captured here.', 'जब कमरे उपलब्ध न होने के कारण ऑनलाइन बुकिंग विफल होगी, तो मेहमान की जानकारी और मांगी गई तारीखें यहाँ दिखाई देंगी।')}
          />
        ) : (
          <Empty
            title={L('No bookings found', 'कोई बुकिंग नहीं मिली')}
            hint={L('Try adjusting your search filters or create a new booking.', 'फ़िल्टर बदलें या नई बुकिंग बनाएं।')}
          />
        )
      ) : subTab === 'failed' ? (
        <>
          {/* Failed Bookings Desktop Table */}
          <div className="hidden overflow-hidden rounded-2xl border border-rose-200 bg-white lg:block shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-rose-50/70 text-left text-xs uppercase tracking-wide text-rose-900 border-b border-rose-100">
                <tr>
                  <th className="px-4 py-3">{L('Customer & Contact', 'ग्राहक व संपर्क')}</th>
                  <th className="px-4 py-3">{L('Requested Category', 'मांगा गया कमरा')}</th>
                  <th className="px-4 py-3">{L('Stay Dates & Nights', 'ठहराव तारीखें')}</th>
                  <th className="px-4 py-3">{L('Reason / Available Dates', 'कारण / उपलब्ध तारीखें')}</th>
                  <th className="px-4 py-3">{L('Attempt Time', 'प्रयास समय')}</th>
                  <th className="px-4 py-3 text-right">{L('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/60">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-rose-50/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{b.guest_name}</p>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                          {L('Unavailable', 'अनुपलब्ध')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">#{b.ref}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs">
                        <a
                          href={`tel:+91${b.phone}`}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-amber-700"
                        >
                          <Phone size={12} className="text-emerald-600" />
                          {b.phone}
                        </a>
                        <a
                          href={`https://wa.me/91${b.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Namaste ${b.guest_name}, regarding your booking attempt at B.S. Hotel for ${b.room_type_name} (${b.check_in} to ${b.check_out}): we noticed rooms were unavailable. Would you like us to help find available dates or alternate options for you?`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <MessageSquare size={12} />
                          WhatsApp
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.room_type_name}</p>
                      <p className="text-xs text-slate-500">{b.guests} {L('guests', 'मेहमान')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.check_in} → {b.check_out}</p>
                      <p className="text-xs text-slate-500">{b.nights} {L('nights', 'रात')}</p>
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200/80">
                        <p className="font-medium leading-relaxed">
                          {b.cancellation_reason || b.admin_notes || L('Selected room type was not available.', 'कमरा उपलब्ध नहीं था।')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {b.created_date ? new Date(b.created_date).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 shadow-sm transition"
                      >
                        <Plus size={12} />
                        {L('Book Room', 'कमरा बुक करें')}
                      </button>
                      <Link
                        to={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {L('Details', 'विवरण')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Failed Bookings Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((b) => (
              <div key={b.id} className="w-full rounded-2xl border border-rose-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{b.guest_name}</p>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        {L('Unavailable', 'अनुपलब्ध')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">#{b.ref}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:+91${b.phone}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                      title="Call"
                    >
                      <Phone size={14} className="text-emerald-600" />
                    </a>
                    <a
                      href={`https://wa.me/91${b.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Namaste ${b.guest_name}, regarding your stay booking inquiry at B.S. Hotel for ${b.room_type_name} (${b.check_in} to ${b.check_out}).`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      title="WhatsApp"
                    >
                      <MessageSquare size={14} />
                    </a>
                  </div>
                </div>

                <div className="text-xs space-y-1 border-t border-slate-100 pt-2">
                  <p className="font-medium text-slate-800">
                    <span className="text-slate-500">{L('Requested:', 'मांगा:')}</span> {b.room_type_name} ({b.guests} {L('guests', 'मेहमान')})
                  </p>
                  <p className="text-slate-600">
                    <span className="text-slate-500">{L('Stay:', 'ठहराव:')}</span> {b.check_in} → {b.check_out} ({b.nights} {L('nights', 'रात')})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {L('Attempted on:', 'प्रयास का समय:')} {b.created_date ? new Date(b.created_date).toLocaleString('en-IN') : '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200/80">
                  <p className="font-medium leading-relaxed">
                    {b.cancellation_reason || b.admin_notes || L('Selected room type was not available.', 'कमरा उपलब्ध नहीं था।')}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  >
                    <Plus size={12} />
                    {L('Book Room', 'कमरा बुक करें')}
                  </button>
                  <Link
                    to={`/admin/bookings/${b.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {L('Details', 'विवरण')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-slate-900">{b.guest_name}</p>
                        {(b.payment_mode === 'upi_qr' || String(b.special_requests || '').includes('PhonePe UPI')) && (
                          <span className="rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-800 inline-flex items-center gap-0.5">
                            <span className="font-bold text-[9px] bg-purple-700 text-white rounded-xs px-1">पे</span>
                            <span>UPI Proof</span>
                          </span>
                        )}
                        {(() => {
                          const s = getScreenshot(b);
                          if (!s) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreenshotModal(s);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:bg-amber-200 transition shadow-2xs cursor-pointer"
                              title={L('Click to view payment screenshot proof in modal', 'भुगतान स्क्रीनशॉट देखने के लिए क्लिक करें')}
                            >
                              <img src={s} alt="Proof" className="h-4 w-4 rounded-xs object-cover border border-amber-400" />
                              <Eye size={11} />
                              <span className="underline underline-offset-2">{L('Photo Proof', 'फोटो प्रमाण')}</span>
                            </button>
                          );
                        })()}
                      </div>
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-slate-900">{b.guest_name}</p>
                      {(b.payment_mode === 'upi_qr' || String(b.special_requests || '').includes('PhonePe UPI')) && (
                        <span className="rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-800 inline-flex items-center gap-0.5">
                          <span className="font-bold text-[9px] bg-purple-700 text-white rounded-xs px-1">पे</span>
                          <span>UPI</span>
                        </span>
                      )}
                      {(() => {
                        const s = getScreenshot(b);
                        if (!s) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScreenshotModal(s);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:bg-amber-200 transition shadow-2xs cursor-pointer"
                          >
                            <img src={s} alt="Proof" className="h-4 w-4 rounded-xs object-cover border border-amber-400" />
                            <Eye size={11} />
                            <span className="underline underline-offset-2">{L('Photo Proof', 'फोटो')}</span>
                          </button>
                        );
                      })()}
                    </div>
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

            {/* PhonePe UPI Proof Preview inside Confirm Modal */}
            {(() => {
              const b = confirmModal.booking;
              const isUpi = b.payment_mode === 'upi_qr' || String(b.special_requests || '').includes('PhonePe UPI') || String(b.admin_notes || '').includes('PhonePe UPI');
              if (!isUpi) return null;

              let utr = b.payment_utr || '';
              let payer = b.payment_name || '';
              const textToScan = `${b.special_requests || ''}\n${b.admin_notes || ''}`;
              if (!utr) {
                const m = textToScan.match(/UTR:\s*([A-Za-z0-9]+)/i);
                if (m) utr = m[1];
              }
              if (!payer) {
                const m = textToScan.match(/Payer:\s*([^|\]\n]+)/i);
                if (m) payer = m[1].trim();
              }
              const s = getScreenshot(b);

              return (
                <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-amber-700" />
                      {L('PhonePe Payment Verification', 'PhonePe भुगतान सत्यापन')}
                    </span>
                    <span className="font-bold text-slate-900">{inr(b.amount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                    <div>
                      <span className="text-slate-500 block text-[10px]">{L('UTR / Ref:', 'UTR नंबर:')}</span>
                      <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-900 select-all">
                        {utr || L('Screenshot only', 'केवल स्क्रीनशॉट')}
                      </code>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">{L('Payer Name:', 'खाताधारक:')}</span>
                      <span className="font-bold text-slate-900 truncate block">{payer || b.guest_name}</span>
                    </div>
                  </div>

                  {s && (
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-amber-900">{L('Payment Screenshot Proof:', 'भुगतान स्क्रीनशॉट:')}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setScreenshotModal(s)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs cursor-pointer"
                        >
                          <Eye size={12} />
                          <span className="underline underline-offset-2">{L('View Full Photo', 'फ़ोटो देखें')}</span>
                        </button>
                        <img
                          src={s}
                          alt="Screenshot"
                          onClick={() => setScreenshotModal(s)}
                          className="h-10 w-10 object-cover rounded-md border border-amber-400 cursor-pointer hover:opacity-80 transition shadow-2xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                  {confirmModal.data.available_dates_formatted ? (
                    <span>
                      {L(
                        `Room "${confirmModal.data.room_type_name}" is not available for the full duration. Available only on: `,
                        `कमरा "${confirmModal.data.room_type_name}" पूरी अवधि के लिए उपलब्ध नहीं है। केवल इन तारीखों पर उपलब्ध: `
                      )}
                      <b className="text-amber-800">{confirmModal.data.available_dates_formatted}</b>
                      {confirmModal.data.booked_dates_formatted && (
                        <span> ({L('Booked on: ', 'बुक है: ')} {confirmModal.data.booked_dates_formatted})</span>
                      )}
                    </span>
                  ) : (
                    L(
                      `All rooms in "${confirmModal.data.room_type_name}" are already fully booked from ${confirmModal.booking.check_in} to ${confirmModal.booking.check_out}. Only ${confirmModal.data.available_count} room(s) available.`,
                      `"${confirmModal.data.room_type_name}" श्रेणी के सभी कमरे ${confirmModal.booking.check_in} से ${confirmModal.booking.check_out} तक भरे हुए हैं। केवल ${confirmModal.data.available_count} कमरा उपलब्ध है।`
                    )
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

      {/* Screenshot Lightbox Modal */}
      {screenshotModal && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setScreenshotModal(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                {L('Guest Payment Screenshot Proof', 'मेहमान द्वारा भेजा गया स्क्रीनशॉट प्रमाण')}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={screenshotModal}
                  download="payment_screenshot_proof.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <ExternalLink size={13} />
                  <span>{L('Open / Download', 'डाउनलोड / खोलें')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setScreenshotModal(null)}
                  className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <img
              src={screenshotModal}
              alt="UPI Screenshot Proof"
              className="w-full h-auto rounded-xl object-contain max-h-[75vh] shadow-inner border border-slate-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}

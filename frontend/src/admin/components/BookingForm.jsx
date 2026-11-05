import { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { checkAvailability, rateForStay, money, todayISO, nightsBetween } from '../lib/adminData';
import DatePicker from '@/components/ui/date-picker';

const empty = { name: '', phone: '', email: '', roomTypeId: '', checkIn: todayISO(), checkOut: '', guests: 2, source: 'phone', special: '', amount: '', advance: 0, payment_mode: 'none', notes: '' };
const ref = () => `RM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export default function BookingForm({ open, onClose, onSaved }) {
  const { L } = useI18n();
  const [types, setTypes] = useState([]);
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ ...empty, checkIn: todayISO() });
    setErr('');
    apiClient.entities.RoomType.filter({ is_active: true }, { sort: 'sort', limit: 50 })
      .then((r) => setTypes(r.items || []))
      .catch(() => setTypes([]));
  }, [open]);

  const type = useMemo(() => types.find((t) => t.id === f.roomTypeId), [types, f.roomTypeId]);
  const nights = f.checkIn && f.checkOut ? nightsBetween(f.checkIn, f.checkOut) : 0;

  // Suggested price: seasonal rule for the arrival night × nights.
  useEffect(() => {
    if (!type || !f.checkIn || nights <= 0) return;
    let alive = true;
    rateForStay(type.id, f.checkIn, type.price).then((rate) => {
      if (alive) setF((p) => ({ ...p, amount: rate * nights }));
    });
    return () => { alive = false; };
  }, [type, f.checkIn, nights]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.name.trim().length < 2) return setErr(L('Enter the guest name.', 'मेहमान का नाम डालें।'));
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, '').slice(-10))) return setErr(L('Enter a valid 10-digit mobile number.', 'सही 10 अंकों का मोबाइल नंबर डालें।'));
    if (!type) return setErr(L('Choose a room type.', 'कमरे का प्रकार चुनें।'));
    if (nights <= 0) return setErr(L('Check-out must be after check-in.', 'चेक-आउट चेक-इन के बाद होना चाहिए।'));

    setBusy(true);
    try {
      const avail = await checkAvailability(type.id, f.checkIn, f.checkOut);
      if (avail.available <= 0) {
        setErr(L('No rooms of this type are free for those dates.', 'इन तारीखों में इस प्रकार का कमरा खाली नहीं है।'));
        setBusy(false);
        return;
      }
      const amount = money(f.amount) || money(type.price) * nights;
      const advance = money(f.advance);
      const created = await apiClient.entities.Booking.create({
        ref: ref(),
        guest_name: f.name.trim(),
        phone: f.phone.replace(/\D/g, '').slice(-10),
        email: f.email.trim(),
        room_type_id: type.id,
        room_type_name: type.name_en,
        check_in: f.checkIn,
        check_out: f.checkOut,
        nights,
        guests: Number(f.guests) || 1,
        special_requests: f.special,
        amount,
        advance_paid: advance,
        balance: Math.max(0, amount - advance),
        payment_mode: f.payment_mode,
        status: 'pending',
        source: f.source,
        notes: f.notes,
        history: [{ status: 'pending', at: new Date().toISOString(), by: 'dashboard' }],
      });
      if (advance > 0) {
        await apiClient.entities.Payment.create({
          booking_id: created.id, amount: advance, mode: f.payment_mode === 'none' ? 'cash' : f.payment_mode,
          kind: 'advance', paid_at: todayISO(), note: L('Advance at booking', 'बुकिंग पर एडवांस'),
        });
      }
      onSaved?.(created);
      onClose();
    } catch (ex) {
      setErr(ex.message || L('Could not save the booking.', 'बुकिंग सेव नहीं हुई।'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{L('New booking', 'नई बुकिंग')}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">{L('Guest name', 'मेहमान का नाम')}<input className={input} value={f.name} onChange={set('name')} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Mobile', 'मोबाइल')}<input className={input} inputMode="tel" value={f.phone} onChange={set('phone')} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Email (optional)', 'ईमेल (वैकल्पिक)')}<input className={input} type="email" value={f.email} onChange={set('email')} /></label>
          <label className="text-sm font-medium text-slate-700">{L('Room type', 'कमरे का प्रकार')}
            <select className={input} value={f.roomTypeId} onChange={set('roomTypeId')} required>
              <option value="">{L('Select', 'चुनें')}</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name_en} · ₹{t.price}</option>)}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">{L('Check-in', 'चेक-इन')}</span>
            <DatePicker variant="admin" value={f.checkIn} onChange={set('checkIn')} placeholder={L('Select check-in', 'चेक-इन चुनें')} />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-700">{L('Check-out', 'चेक-आउट')}</span>
            <DatePicker variant="admin" min={f.checkIn} value={f.checkOut} onChange={set('checkOut')} placeholder={L('Select check-out', 'चेक-आउट चुनें')} />
          </div>
          <label className="text-sm font-medium text-slate-700">{L('Guests', 'मेहमान')}<input className={input} type="number" min="1" value={f.guests} onChange={set('guests')} /></label>
          <label className="text-sm font-medium text-slate-700">{L('Source', 'स्रोत')}
            <select className={input} value={f.source} onChange={set('source')}>
              <option value="phone">{L('Phone', 'फ़ोन')}</option>
              <option value="walkin">{L('Walk-in', 'वॉक-इन')}</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">{L('Website', 'वेबसाइट')}</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">{L('Total amount', 'कुल राशि')}<input className={input} type="number" min="0" value={f.amount} onChange={set('amount')} /></label>
          <label className="text-sm font-medium text-slate-700">{L('Advance received', 'एडवांस मिला')}<input className={input} type="number" min="0" value={f.advance} onChange={set('advance')} /></label>
          <label className="text-sm font-medium text-slate-700">{L('Payment mode', 'भुगतान माध्यम')}
            <select className={input} value={f.payment_mode} onChange={set('payment_mode')}>
              <option value="none">{L('Not paid', 'नहीं')}</option>
              <option value="cash">{L('Cash', 'नकद')}</option>
              <option value="upi">UPI</option>
              <option value="card">{L('Card', 'कार्ड')}</option>
              <option value="online">{L('Online', 'ऑनलाइन')}</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">{L('Special requests', 'विशेष अनुरोध')}<input className={input} value={f.special} onChange={set('special')} /></label>
        </div>

        {nights > 0 && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{nights} {L('night(s)', 'रात')} · {L('Balance', 'बाकी')}: ₹{Math.max(0, money(f.amount) - money(f.advance)).toLocaleString('en-IN')}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700">{L('Cancel', 'रद्द')}</button>
          <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <><Loader2 className="animate-spin" size={16} /> {L('Saving…', 'सेव हो रहा है…')}</> : L('Save booking', 'बुकिंग सेव करें')}
          </button>
        </div>
      </form>
    </div>
  );
}
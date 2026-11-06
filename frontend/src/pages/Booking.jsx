import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Calendar, Info } from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import BookingConfirmation from '@/components/site/BookingConfirmation';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { ROOMS } from '@/data/rooms';
import { useI18n } from '@/lib/i18n';
import { isValidPhone } from '@/lib/whatsapp';
import { submitBooking } from '@/lib/services';
import useSeo from '@/lib/useSeo';
import DatePicker from '@/components/ui/date-picker';
import PhoneInput from '@/components/ui/phone-input';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function Booking() {
  const { t, tr } = useI18n();
  const { data: rooms } = useRoomTypes();
  const roomList = (rooms && rooms.length > 0) ? rooms : ROOMS;
  const [q] = useSearchParams();
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    checkIn: q.get('in') || '',
    checkOut: q.get('out') || '',
    guests: q.get('guests') || 2,
    room: q.get('room') || (roomList[0]?.id || 'standard'),
    special: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useSeo('Book a Room | B.S. Hotel, Mathura NH-2', 'Request a room booking at B.S. Hotel near Township Nagar, NH-2, Baad (Mathura) and confirm on WhatsApp.');

  useEffect(() => {
    if (!f.room && roomList.length > 0) {
      setF((prev) => ({ ...prev, room: roomList[0].id }));
    }
  }, [roomList, f.room]);

  const set = (k) => (e) => {
    setServerError('');
    setF((prev) => ({ ...prev, [k]: e?.target ? e.target.value : e }));
  };

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Please enter your name.';
    if (!isValidPhone(f.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email or leave it blank.';
    if (!f.checkIn) e.checkIn = 'Choose a check-in date.';
    else if (f.checkIn < today()) e.checkIn = 'Check-in cannot be in the past.';
    if (!f.checkOut) e.checkOut = 'Choose a check-out date.';
    else if (f.checkIn && f.checkOut <= f.checkIn) e.checkOut = 'Check-out must be after check-in.';
    if (!(Number(f.guests) >= 1)) e.guests = 'At least 1 guest.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    const selectedRoomId = f.room || roomList[0]?.id || '';
    const room = roomList.find((r) => r.id === selectedRoomId) || roomList[0];
    const nights = Math.max(1, Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000));
    const roomName = room ? (typeof room.name === 'object' ? tr(room.name) : (room.name_en || room.name)) : 'Room';

    try {
      const res = await submitBooking({
        ...f,
        room: room?.id || '',
        roomName,
        nights,
        amount: ((room?.price || 0) * nights),
      });
      setDone(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Booking submission error:', err);
      setServerError(err.message || 'Selected room is not available for the chosen dates. Please choose different dates.');
    } finally {
      setBusy(false);
    }
  };

  const room = roomList.find((r) => r.id === f.room) || roomList[0];
  const nights = f.checkIn && f.checkOut && f.checkOut > f.checkIn
    ? Math.max(1, Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000))
    : 0;

  return (
    <>
      <PageHero title={t('cta.bookRoom')} sub="Send a booking request. We confirm availability and rates on WhatsApp or phone." />
      <section className="mx-auto max-w-3xl px-4 py-12">
        {done ? <BookingConfirmation booking={done} /> : (
          <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-primary/30 bg-card p-6 md:grid-cols-2 md:p-8">
            <label className="text-sm">{t('f.name')}<input className="field mt-1" value={f.name} onChange={set('name')} autoComplete="name" /><Err m={errors.name} /></label>
            <label className="text-sm">
              {t('f.phone')}
              <PhoneInput value={f.phone} onChange={set('phone')} className="mt-1" />
              <Err m={errors.phone} />
            </label>
            <label className="text-sm md:col-span-2">{t('f.email')}<input className="field mt-1" type="email" value={f.email} onChange={set('email')} /><Err m={errors.email} /></label>
            <div className="space-y-1">
              <span className="text-sm font-medium">{t('f.checkIn')}</span>
              <DatePicker min={today()} value={f.checkIn} onChange={set('checkIn')} placeholder={t('f.checkIn')} className="field mt-1" />
              <Err m={errors.checkIn} />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">{t('f.checkOut')}</span>
              <DatePicker min={f.checkIn || today()} value={f.checkOut} onChange={set('checkOut')} placeholder={t('f.checkOut')} className="field mt-1" />
              <Err m={errors.checkOut} />
            </div>
            <label className="text-sm">{t('f.guests')}<input className="field mt-1" type="number" min="1" max="10" value={f.guests} onChange={set('guests')} /><Err m={errors.guests} /></label>
            <label className="text-sm">{t('f.roomType')}
              <select className="field mt-1" value={f.room || roomList[0]?.id} onChange={set('room')}>
                {roomList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {typeof r.name === 'object' ? tr(r.name) : (r.name_en || r.name)}
                    {r.price ? ` — ₹${Number(r.price).toLocaleString('en-IN')}/night` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">{t('f.special')}<textarea className="field mt-1 py-3" rows={3} value={f.special} onChange={set('special')} /></label>

            {nights > 0 && room && (
              <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  {nights} {nights === 1 ? 'night' : 'nights'} stay ({f.checkIn} → {f.checkOut})
                </span>
                <span className="font-semibold text-amber-300">
                  Total est: ₹{((room.price || 0) * nights).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {serverError && (
              <div className="md:col-span-2 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 sm:p-5 text-rose-100 shadow-lg backdrop-blur-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-rose-200 text-sm sm:text-base">
                      {t('rooms.unavailableTitle', 'Dates Not Available / कमरा उपलब्ध नहीं है')}
                    </h4>
                    <p className="text-sm font-medium leading-relaxed text-rose-100/90">
                      {serverError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-gold md:col-span-2">{busy ? '…' : t('cta.requestBooking')}</button>
          </form>
        )}
      </section>
    </>
  );
}

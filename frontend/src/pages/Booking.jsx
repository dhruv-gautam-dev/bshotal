import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHero from '@/components/site/PageHero';
import BookingConfirmation from '@/components/site/BookingConfirmation';
import { useRoomTypes } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';
import { isValidPhone } from '@/lib/whatsapp';
import { submitBooking } from '@/lib/services';
import useSeo from '@/lib/useSeo';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function Booking() {
  const { t, tr } = useI18n();
  const { data: rooms } = useRoomTypes();
  const roomList = rooms || [];
  const [q] = useSearchParams();
  const [f, setF] = useState({ name: '', phone: '', email: '', checkIn: q.get('in') || '', checkOut: q.get('out') || '', guests: q.get('guests') || 2, room: q.get('room') || '', special: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useSeo('Book a Room | B.S. Hotel, Mathura NH-2', 'Request a room booking at B.S. Hotel near Township Nagar, NH-2, Baad (Mathura) and confirm on WhatsApp.');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

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
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const room = roomList.find((r) => r.id === f.room) || roomList[0];
    const nights = Math.max(1, Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000));
    const roomName = room ? (typeof room.name === 'object' ? tr(room.name) : (room.name_en || room.name)) : 'Room';
    const res = await submitBooking({ ...f, room: room?.id || '', roomName, nights, amount: ((room?.price || 0) * nights) });
    setBusy(false);
    setDone(res);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHero title={t('cta.bookRoom')} sub="Send a booking request. We confirm availability and rates on WhatsApp or phone." />
      <section className="mx-auto max-w-3xl px-4 py-12">
        {done ? <BookingConfirmation booking={done} /> : (
          <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-primary/30 bg-card p-6 md:grid-cols-2 md:p-8">
            <label className="text-sm">{t('f.name')}<input className="field mt-1" value={f.name} onChange={set('name')} autoComplete="name" /><Err m={errors.name} /></label>
            <label className="text-sm">{t('f.phone')}<input className="field mt-1" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="98765 43210" /><Err m={errors.phone} /></label>
            <label className="text-sm md:col-span-2">{t('f.email')}<input className="field mt-1" type="email" value={f.email} onChange={set('email')} /><Err m={errors.email} /></label>
            <label className="text-sm">{t('f.checkIn')}<input className="field mt-1" type="date" min={today()} value={f.checkIn} onChange={set('checkIn')} /><Err m={errors.checkIn} /></label>
            <label className="text-sm">{t('f.checkOut')}<input className="field mt-1" type="date" min={f.checkIn || today()} value={f.checkOut} onChange={set('checkOut')} /><Err m={errors.checkOut} /></label>
            <label className="text-sm">{t('f.guests')}<input className="field mt-1" type="number" min="1" max="10" value={f.guests} onChange={set('guests')} /><Err m={errors.guests} /></label>
            <label className="text-sm">{t('f.roomType')}
              <select className="field mt-1" value={f.room} onChange={set('room')}>{roomList.map((r) => <option key={r.id} value={r.id}>{tr(r.name)}</option>)}</select>
            </label>
            <label className="text-sm md:col-span-2">{t('f.special')}<textarea className="field mt-1 py-3" rows={3} value={f.special} onChange={set('special')} /></label>
            <button type="submit" disabled={busy} className="btn-gold md:col-span-2">{busy ? '…' : t('cta.requestBooking')}</button>
          </form>
        )}
      </section>
    </>
  );
}
import { useEffect, useState } from 'react';
import { EVENTS } from '@/data/events';
import { useI18n } from '@/lib/i18n';
import { isValidPhone, openWhatsApp } from '@/lib/whatsapp';
import { submitEnquiry, enquiryMessage } from '@/lib/services';
import { MessageCircle } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function EnquiryForm({ eventType }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: '', phone: '', eventType: EVENTS[0].value, date: '', guests: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (eventType) setF((p) => ({ ...p, eventType })); }, [eventType]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Please enter your name.';
    if (!isValidPhone(f.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (f.date && f.date < today()) e.date = 'Choose a future date.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      setSent(await submitEnquiry(f));
    } finally { setBusy(false); }
  };

  return (
    <form id="enquiry" onSubmit={submit} noValidate className="mx-auto grid max-w-3xl scroll-mt-24 gap-5 rounded-2xl border border-primary/30 bg-card p-6 md:grid-cols-2 md:p-8">
      <label className="text-sm">{t('f.name')}<input className="field mt-1" value={f.name} onChange={set('name')} /><Err m={errors.name} /></label>
      <label className="text-sm">{t('f.phone')}<input className="field mt-1" inputMode="tel" value={f.phone} onChange={set('phone')} /><Err m={errors.phone} /></label>
      <label className="text-sm">Event type<select className="field mt-1" value={f.eventType} onChange={set('eventType')}>{EVENTS.map((e) => <option key={e.id}>{e.value}</option>)}<option>Custom package / Catering</option></select></label>
      <label className="text-sm">{t('f.date')}<input className="field mt-1" type="date" min={today()} value={f.date} onChange={set('date')} /><Err m={errors.date} /></label>
      <label className="text-sm md:col-span-2">Expected guests<input className="field mt-1" type="number" min="1" value={f.guests} onChange={set('guests')} /></label>
      <label className="text-sm md:col-span-2">{t('f.message')}<textarea className="field mt-1 py-3" rows={3} value={f.message} onChange={set('message')} /></label>
      <button type="submit" disabled={busy} className="btn-gold md:col-span-2">{busy ? 'Sending…' : t('cta.enquire')}</button>
      {sent && (
        <div className="md:col-span-2">
          <p className="text-sm text-primary">Thank you {sent.name}, enquiry <b>{sent.ref}</b> is with our events team. We will call you on {sent.phone}.</p>
          <button type="button" onClick={() => openWhatsApp(enquiryMessage(sent))} className="btn-outline mt-2 w-full">
            <MessageCircle size={18} />Send on WhatsApp too (optional)
          </button>
        </div>
      )}
    </form>
  );
}
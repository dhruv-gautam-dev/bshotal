import { useEffect, useState } from 'react';
import { useEventPackages } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';
import { isValidPhone, openWhatsApp } from '@/lib/whatsapp';
import { submitEnquiry, enquiryMessage } from '@/lib/services';
import { MessageCircle } from 'lucide-react';
import DatePicker from '@/components/ui/date-picker';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function EnquiryForm({ eventType }) {
  const { t } = useI18n();
  const { data: packages } = useEventPackages();
  const eventTypes = (packages || []).map((p) => p.title || p.name);
  const defaultType = eventTypes[0] || 'Ring Ceremony';

  const [f, setF] = useState({ name: '', phone: '', eventType: defaultType, date: '', guests: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (eventType) setF((p) => ({ ...p, eventType }));
    else if (!f.eventType && defaultType) setF((p) => ({ ...p, eventType: defaultType }));
  }, [eventType, defaultType]);

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
      <label className="text-sm">Event type
        <select className="field mt-1" value={f.eventType} onChange={set('eventType')}>
          {eventTypes.length ? eventTypes.map((val) => <option key={val} value={val}>{val}</option>) : (
            <>
              <option value="Ring Ceremony">Ring Ceremony</option>
              <option value="Birthday Party">Birthday Party</option>
              <option value="Wedding">Wedding</option>
            </>
          )}
          <option value="Custom package / Catering">Custom package / Catering</option>
        </select>
      </label>
      <div className="space-y-1">
        <span className="text-sm font-medium">{t('f.date')}</span>
        <DatePicker min={today()} value={f.date} onChange={set('date')} placeholder={t('f.date')} className="field mt-1" />
        <Err m={errors.date} />
      </div>
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
import { useEffect, useState } from 'react';
import { useEventPackages } from '@/hooks/useSiteCatalog';
import { useI18n } from '@/lib/i18n';
import { isValidPhone, openWhatsApp } from '@/lib/whatsapp';
import { submitEnquiry, enquiryMessage } from '@/lib/services';
import { MessageCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import DatePicker from '@/components/ui/date-picker';

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function EnquiryForm({ eventType }) {
  const { t, L } = useI18n();
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
      const res = await submitEnquiry(f);
      setSent(res);
      // Empty the form completely
      setF({ name: '', phone: '', eventType: defaultType, date: '', guests: '', message: '' });
      setErrors({});
    } catch (err) {
      setErrors({ form: err.message || 'Failed to send enquiry. Please call us directly.' });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div id="enquiry" className="mx-auto max-w-2xl scroll-mt-24 rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-lg">
        <CheckCircle2 className="mx-auto text-primary" size={52} />
        <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Ref: #{sent.ref}
        </span>
        <h2 className="mt-3 text-2xl font-bold text-foreground">
          {L('Enquiry Received Successfully!', 'पूछताछ सफलतापूर्वक प्राप्त हुई!')}
        </h2>
        <div className="mx-auto mt-4 max-w-lg rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          <p>
            {L('Thank you', 'धन्यवाद')} <b className="text-primary">{sent.name}</b>, {L('your enquiry for', 'आपकी')} <b className="text-primary">{sent.eventType}</b> {L('is with our events team.', 'हमारी टीम को मिल गई है।')}
          </p>
          <p className="mt-2 font-medium text-primary">
            {L('We will call you on', 'हम आपको शीघ्र ही कॉल करेंगे:')} <span className="underline">{sent.phone}</span>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => openWhatsApp(enquiryMessage(sent))}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} />
            {L('Send on WhatsApp too (Instant)', 'व्हाट्सएप पर भी भेजें (त्वरित)')}
          </button>
          <button
            type="button"
            onClick={() => setSent(null)}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw size={16} />
            {L('Submit another enquiry', 'एक और पूछताछ भेजें')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form id="enquiry" onSubmit={submit} noValidate className="mx-auto grid max-w-3xl scroll-mt-24 gap-5 rounded-2xl border border-primary/30 bg-card p-6 md:grid-cols-2 md:p-8">
      {errors.form && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-600 md:col-span-2">
          {errors.form}
        </div>
      )}
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
    </form>
  );
}
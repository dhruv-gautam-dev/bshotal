import { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import { SITE } from '@/data/site';
import { useI18n } from '@/lib/i18n';
import { isValidPhone, openWhatsApp, waLink } from '@/lib/whatsapp';
import { submitContact } from '@/lib/services';
import useSeo from '@/lib/useSeo';
import PhoneInput from '@/components/ui/phone-input';

export default function Contact() {
  const { t, tr } = useI18n();
  const [f, setF] = useState({ name: '', phone: '', message: '' });
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  useSeo('Contact | B.S. Hotel, Township Nagar NH-2 Mathura', 'Call +91 91492 24039 for bookings, +91 92592 73735 for payments or WhatsApp B.S. Hotel & Restaurant near Township Nagar, NH-2, Baad (Mathura).');
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    
    if (f.name.trim().length < 2) return setErr('Please enter your name.');
    if (!isValidPhone(f.phone)) return setErr('Enter a valid 10-digit Indian mobile number.');
    if (f.message.trim().length < 5) return setErr('Please write a short message.');
    setErr('');
    setBusy(true);
    try {
      setSent(await submitContact(f));
      setF({ name: '', phone: '', message: '' });
    } catch {
      setErr('Could not send your message. Please call us instead.');
    } finally { setBusy(false); }
  };

  const row = 'flex items-start gap-3 py-2';
  return (
    <>
      <PageHero title={t('nav.contact')} sub="We are happy to help with rooms, food and events." />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
        <div>
          <a className={row} href={`tel:${SITE.tel1}`}>
            <Phone className="mt-1 shrink-0 text-primary" size={20} />
            <div>
              <span className="font-medium text-foreground">{SITE.phone1}</span>
              <span className="block text-xs text-muted-foreground">{t('nav.bookings') || 'Bookings'} & Inquiries</span>
            </div>
          </a>
          <a className={row} href={`tel:${SITE.tel2}`}>
            <Phone className="mt-1 shrink-0 text-primary" size={20} />
            <div>
              <span className="font-medium text-foreground">{SITE.phone2}</span>
              <span className="block text-xs text-muted-foreground">Payments, Accounts & Billing</span>
            </div>
          </a>
          <a className={row} href={waLink()} target="_blank" rel="noopener noreferrer"><MessageCircle className="mt-1 text-primary" size={20} />WhatsApp</a>
          <p className={row}><MapPin className="mt-1 shrink-0 text-primary" size={20} />{tr(SITE.address)}</p>
          <p className={row}><Clock className="mt-1 shrink-0 text-primary" size={20} />{tr(SITE.hours)}</p>
          <iframe title="Map" src={SITE.mapEmbed} loading="lazy" className="mt-4 h-72 w-full rounded-2xl border border-primary/30" />
        </div>
        {sent ? (
          <div className="self-start rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto text-primary" size={40} />
            <h2 className="mt-3 text-2xl font-semibold">Message received</h2>
            <p className="mt-2 text-sm text-muted-foreground">Reference <b className="text-primary">{sent.ref}</b>. Our team will call you back.</p>
            <button type="button" onClick={() => openWhatsApp(`*Contact message* (Ref: ${sent.ref})\nName: ${sent.name}\nPhone: ${sent.phone}\n${sent.message}`)} className="btn-outline mt-5 w-full">
              <MessageCircle size={20} />Send on WhatsApp too (optional)
            </button>
            <button type="button" onClick={() => setSent(null)} className="mt-3 text-sm text-primary">Send another message</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4 self-start rounded-2xl border border-primary/30 bg-card p-6">
            <label className="block text-sm">{t('f.name')}<input className="field mt-1" value={f.name} onChange={set('name')} /></label>
            <label className="block text-sm">
              {t('f.phone')}
              <PhoneInput value={f.phone} onChange={set('phone')} className="mt-1" />
            </label>
            <label className="block text-sm">{t('f.message')}<textarea className="field mt-1 py-3" rows={5} value={f.message} onChange={set('message')} /></label>
            {err && <p className="text-sm text-red-400" role="alert">{err}</p>}
            <button type="submit" disabled={busy} className="btn-gold w-full"><MessageCircle size={20} />{busy ? 'Sending…' : t('f.send')}</button>
          </form>
        )}
      </section>
    </>
  );
}
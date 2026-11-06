import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, CheckCircle2 } from 'lucide-react';
import PageHero from '@/components/site/PageHero';
import CartLine from '@/components/site/CartLine';
import { useCart } from '@/lib/cart';
import { useI18n } from '@/lib/i18n';
import { inr, isValidPhone, openWhatsApp } from '@/lib/whatsapp';
import { computeTotals, orderMessage, submitOrder } from '@/lib/services';
import { useOrderConfig } from '@/hooks/useSiteCatalog';
import useSeo from '@/lib/useSeo';
import PhoneInput from '@/components/ui/phone-input';

const TYPES = ['Dine-in', 'Pickup', 'Delivery'];
const Err = ({ m }) => (m ? <p className="mt-1 text-sm text-red-400" role="alert">{m}</p> : null);

export default function Order() {
  const { t } = useI18n();
  const cart = useCart();
  const [f, setF] = useState({ type: 'Dine-in', table: '', address: '', name: '', phone: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(null);
  useSeo('Order Food | Delicee Restaurant, Mathura NH-2', 'Order pure vegetarian food from Delicee Restaurant at B.S. Hotel: dine-in, pickup or delivery via WhatsApp.');
  const set = (k) => (e) => {
    setServerError('');
    setF({ ...f, [k]: e?.target ? e.target.value : e });
  };
  const orderConfig = useOrderConfig();
  const { delivery, tax, total } = computeTotals(cart.subtotal, f.type, orderConfig);

  const send = async () => {
    setServerError('');
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Please enter your name.';
    if (!isValidPhone(f.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (f.type === 'Delivery' && f.address.trim().length < 8) e.address = 'Please enter the full delivery address.';
    if (f.type === 'Dine-in' && !f.table.trim()) e.table = 'Enter your table number.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const order = await submitOrder({ ...f, items: cart.items, subtotal: cart.subtotal, delivery, tax, total });
      setDone(order);
      cart.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Order submission error:', err);
      setServerError(err.message || 'Unable to place order. You can still order directly via WhatsApp below.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <PageHero title="Order sent" />
        <section className="mx-auto max-w-xl px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto text-primary" size={48} />
          <p className="mt-4">Your order is with the kitchen. Reference <b className="text-primary">{done.ref}</b>.</p>
          <button type="button" onClick={() => openWhatsApp(orderMessage(done))} className="btn-outline mt-6"><MessageCircle size={20} />Send on WhatsApp too (optional)</button>
          <div><Link to="/restaurant" className="mt-3 inline-block py-2 text-primary">Back to menu</Link></div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero title={t('nav.order')} sub="Review your cart, add your details and send the order on WhatsApp." />
      <section className="mx-auto max-w-5xl px-4 py-12">
        {cart.items.length === 0 ? (
          <div className="py-12 text-center"><p className="text-muted-foreground">Your cart is empty.</p><Link to="/restaurant" className="btn-gold mt-5">{t('cta.viewMenu')}</Link></div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <ul>{cart.items.map((i) => <CartLine key={i.id} item={i} />)}</ul>
              <div className="mt-4 space-y-1 text-sm">
                <p className="flex justify-between"><span>Subtotal</span><span>{inr(cart.subtotal)}</span></p>
                <p className="flex justify-between text-muted-foreground"><span>Delivery charge</span><span>{f.type === 'Delivery' ? inr(delivery) : '—'}</span></p>
                <p className="flex justify-between text-muted-foreground"><span>Taxes</span><span>{inr(tax)}</span></p>
                <p className="flex justify-between border-t border-primary/30 pt-2 text-lg font-bold text-primary"><span>Total</span><span>{inr(total)}</span></p>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-primary/30 bg-card p-6">
              <fieldset>
                <legend className="mb-2 text-sm">Order type</legend>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((ty) => (
                    <button key={ty} type="button" aria-pressed={f.type === ty} onClick={() => setF({ ...f, type: ty })} className={`min-h-[48px] rounded-lg border text-sm font-semibold ${f.type === ty ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>{ty}</button>
                  ))}
                </div>
              </fieldset>
              {f.type === 'Dine-in' && <label className="block text-sm">Table number<input className="field mt-1" value={f.table} onChange={set('table')} /><Err m={errors.table} /></label>}
              {f.type === 'Delivery' && <label className="block text-sm">Delivery address<textarea className="field mt-1 py-3" rows={3} value={f.address} onChange={set('address')} /><Err m={errors.address} /></label>}
              <label className="block text-sm">{t('f.name')}<input className="field mt-1" value={f.name} onChange={set('name')} autoComplete="name" /><Err m={errors.name} /></label>
              <label className="block text-sm">
                {t('f.phone')}
                <PhoneInput value={f.phone} onChange={set('phone')} className="mt-1" />
                <Err m={errors.phone} />
              </label>
              <label className="block text-sm">Order notes<textarea className="field mt-1 py-3" rows={2} value={f.notes} onChange={set('notes')} /></label>

              {serverError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
                  {serverError}
                </div>
              )}

              <button type="button" onClick={send} disabled={busy} className="btn-gold w-full flex items-center justify-center gap-2">
                <MessageCircle size={20} />
                {busy ? 'Placing order…' : 'Place order'}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

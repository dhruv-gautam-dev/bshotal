import { useEffect, useMemo, useState } from 'react';
import { X, Minus, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { getSettings, money, todayISO } from '../lib/adminData';

const ref = () => `FD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export default function OrderForm({ open, onClose, onSaved }) {
  const { L } = useI18n();
  const [f, setF] = useState({ name: '', phone: '', type: 'dine-in', table: '', address: '', notes: '' });
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin-order-form'],
    enabled: open,
    queryFn: async () => {
      const [items, settings] = await Promise.all([
        apiClient.entities.MenuItem.filter({ is_available: true }, { sort: 'sort', limit: 300 }),
        getSettings(),
      ]);
      return { items: items.items || [], settings };
    },
  });

  useEffect(() => { if (open) { setLines([]); setErr(''); setF({ name: '', phone: '', type: 'dine-in', table: '', address: '', notes: '' }); } }, [open]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const tax = Math.round((subtotal * (Number(data?.settings?.tax_percent) || 0)) / 100);
  const delivery = f.type === 'delivery' ? money(data?.settings?.delivery_charge) : 0;
  const total = subtotal + tax + delivery;

  const addLine = (item) => setLines((prev) => {
    const found = prev.find((l) => l.item_id === item.id);
    if (found) return prev.map((l) => (l.item_id === item.id ? { ...l, qty: l.qty + 1 } : l));
    return [...prev, { item_id: item.id, name: item.name_en, price: money(item.price), qty: 1, note: '' }];
  });
  const bump = (id, delta) => setLines((prev) => prev.map((l) => (l.item_id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.name.trim().length < 2) return setErr(L('Enter the customer name.', 'ग्राहक का नाम डालें।'));
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, '').slice(-10))) return setErr(L('Enter a valid mobile number.', 'सही मोबाइल नंबर डालें।'));
    if (!lines.length) return setErr(L('Add at least one dish.', 'कम से कम एक डिश जोड़ें।'));
    setBusy(true);
    try {
      const created = await apiClient.entities.Order.create({
        ref: ref(), customer_name: f.name.trim(), phone: f.phone.replace(/\D/g, '').slice(-10),
        type: f.type, table_no: f.table, address: f.address, items: lines,
        subtotal, tax, delivery, total, notes: f.notes, status: 'new',
        payment_status: 'unpaid', payment_mode: 'none', source: 'walkin',
      });
      onSaved?.(created);
      onClose();
    } catch (ex) {
      setErr(ex.message || L('Could not save the order.', 'ऑर्डर सेव नहीं हुआ।'));
    } finally { setBusy(false); }
  };

  if (!open) return null;
  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{L('New order', 'नया ऑर्डर')}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">{L('Customer', 'ग्राहक')}<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Mobile', 'मोबाइल')}<input className={input} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Order type', 'ऑर्डर प्रकार')}
            <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="dine-in">{L('Dine-in', 'डाइन-इन')}</option>
              <option value="pickup">{L('Pickup', 'पिकअप')}</option>
              <option value="delivery">{L('Delivery', 'डिलीवरी')}</option>
            </select>
          </label>
          {f.type === 'dine-in' && <label className="text-sm font-medium text-slate-700">{L('Table no.', 'टेबल नं.')}<input className={input} value={f.table} onChange={(e) => setF({ ...f, table: e.target.value })} /></label>}
          {f.type === 'delivery' && <label className="text-sm font-medium text-slate-700 sm:col-span-2">{L('Address', 'पता')}<input className={input} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">{L('Dishes', 'डिश')}</p>
          <select onChange={(e) => { const it = (data?.items || []).find((i) => i.id === e.target.value); if (it) addLine(it); e.target.value = ''; }} className={input} defaultValue="">
            <option value="">{L('Add a dish…', 'डिश जोड़ें…')}</option>
            {(data?.items || []).map((i) => <option key={i.id} value={i.id}>{i.name_en} · ₹{i.price}</option>)}
          </select>
          <ul className="mt-2 divide-y divide-slate-100">
            {lines.map((l) => (
              <li key={l.item_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.name} <span className="text-slate-500">×{l.qty}</span></span>
                <span className="tabular-nums">₹{l.price * l.qty}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => bump(l.item_id, -1)} className="rounded-lg border border-slate-300 p-1.5"><Minus size={14} /></button>
                  <button type="button" onClick={() => bump(l.item_id, 1)} className="rounded-lg border border-slate-300 p-1.5"><Plus size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
          {lines.length === 0 && <p className="py-3 text-center text-xs text-slate-500">{L('No dishes added yet.', 'अभी कोई डिश नहीं।')}</p>}
        </div>

        <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="flex justify-between"><span>{L('Subtotal', 'सबटोटल')}</span><span>₹{subtotal}</span></p>
          <p className="flex justify-between text-slate-500"><span>{L('Tax', 'टैक्स')}</span><span>₹{tax}</span></p>
          {delivery > 0 && <p className="flex justify-between text-slate-500"><span>{L('Delivery', 'डिलीवरी')}</span><span>₹{delivery}</span></p>}
          <p className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span>{L('Total', 'कुल')}</span><span>₹{total}</span></p>
        </div>

        <label className="mt-3 block text-sm font-medium text-slate-700">{L('Notes', 'नोट्स')}<input className={input} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
          <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <><Loader2 className="animate-spin" size={16} /> {L('Saving…', 'सेव…')}</> : L('Save order', 'ऑर्डर सेव करें')}
          </button>
        </div>
      </form>
    </div>
  );
}
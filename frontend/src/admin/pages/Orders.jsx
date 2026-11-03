import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Printer, X, Phone } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import {
  ORDER_STATUS, ORDER_TYPES, getSettings, inr, money, audit, downloadCsv, printHtml, todayISO,
} from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Empty from '../components/Empty';
import OrderForm from '../components/OrderForm';

const COLUMNS = ['new', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'];
const NEXT = {
  new: 'accepted', accepted: 'preparing', preparing: 'ready',
  ready: 'out_for_delivery', out_for_delivery: 'completed', served: 'completed',
};

export default function Orders() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('board');
  const [openForm, setOpenForm] = useState(params.get('new') === '1');
  const [active, setActive] = useState(null);
  const [settings, setSettings] = useState(null);
  const qc = useQueryClient();

  useEffect(() => { setOpenForm(params.get('new') === '1'); }, [params]);
  useEffect(() => { getSettings().then(setSettings); }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => (await apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 200 })).items,
  });

  // Live board: a new website order appears without a manual refresh.
  useEffect(() => {
    const unsub = apiClient.entities.Order.subscribe(() => qc.invalidateQueries({ queryKey: ['admin-orders'] }));
    return unsub;
  }, [qc]);

  const move = async (order, status) => {
    await apiClient.entities.Order.update(order.id, { status });
    await audit(me, 'status', 'orders', 'Order', order.id, `${order.ref}: ${order.status} → ${status}`);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    setActive((a) => (a && a.id === order.id ? { ...a, status } : a));
  };

  const markPaid = async (order) => {
    await apiClient.entities.Order.update(order.id, { payment_status: 'paid', payment_mode: order.payment_mode === 'none' ? 'cash' : order.payment_mode });
    await audit(me, 'payment', 'orders', 'Order', order.id, `${order.ref} marked paid`);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    setActive({ ...order, payment_status: 'paid' });
  };

  const kot = (o) => printHtml(`KOT ${o.ref}`, `
    <h1>KITCHEN ORDER</h1><p class="muted">${o.ref} · ${new Date(o.created_date || o.created_at || Date.now()).toLocaleString('en-IN')} · ${o.type}${o.table_no ? ` · Table ${o.table_no}` : ''}</p>
    <table>${(o.items || []).map((i) => `<tr><td style="font-size:15px"><b>${i.qty}×</b> ${i.name}${i.note ? `<br/><span class="muted">${i.note}</span>` : ''}</td></tr>`).join('')}</table>
    ${o.notes ? `<h2>Note</h2><p>${o.notes}</p>` : ''}
  `);

  const bill = (o) => printHtml(`Bill ${o.ref}`, `
    <h1>${settings?.hotel_name || 'B.S. Hotel & Delicee Restaurant'}</h1>
    <p class="muted">${settings?.address_en || ''}<br/>${settings?.phone_primary || ''}${settings?.gst ? ` · GSTIN ${settings.gst}` : ''}</p>
    <h2>Bill ${o.ref}</h2>
    <p class="muted">${new Date(o.created_date || o.created_at || Date.now()).toLocaleString('en-IN')} · ${o.customer_name} · ${o.phone}</p>
    <table>${(o.items || []).map((i) => `<tr><td>${i.name} × ${i.qty}</td><td class="r">${inr(i.price * i.qty)}</td></tr>`).join('')}</table>
    <table>
      <tr><td>Subtotal</td><td class="r">${inr(o.subtotal)}</td></tr>
      <tr><td>Tax</td><td class="r">${inr(o.tax)}</td></tr>
      ${o.delivery ? `<tr><td>Delivery</td><td class="r">${inr(o.delivery)}</td></tr>` : ''}
      <tr><td class="total">Total</td><td class="r total">${inr(o.total)}</td></tr>
    </table>
    <p class="muted" style="margin-top:20px">Thank you · Serving Food With Love</p>
  `);

  const today = todayISO();
  const history = useMemo(() => orders.filter((o) => !['new', 'accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status) || (o.created_date || o.created_at || '') < today), [orders, today]);

  const exportCsv = () => downloadCsv('orders.csv', orders, [
    { label: 'Ref', value: (o) => o.ref },
    { label: 'Date', value: (o) => (o.created_date || o.created_at || '').slice(0, 16).replace('T', ' ') },
    { label: 'Customer', value: (o) => o.customer_name },
    { label: 'Phone', value: (o) => o.phone },
    { label: 'Type', value: (o) => o.type },
    { label: 'Items', value: (o) => (o.items || []).map((i) => `${i.name} x${i.qty}`).join('; ') },
    { label: 'Total', value: (o) => o.total },
    { label: 'Status', value: (o) => o.status },
    { label: 'Payment', value: (o) => `${o.payment_status}/${o.payment_mode}` },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{L('Food orders', 'खाने के ऑर्डर')}</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Download size={16} />CSV</button>
          <button onClick={() => setOpenForm(true)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('New order', 'नया ऑर्डर')}</button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[['board', L('Live board', 'लाइव बोर्ड')], ['history', L('Order history', 'ऑर्डर इतिहास')]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : tab === 'board' ? (
        orders.length === 0 ? <Empty title={L('No orders yet', 'अभी कोई ऑर्डर नहीं')} hint={L('Website orders arrive here automatically.', 'वेबसाइट के ऑर्डर यहाँ अपने आप आएँगे।')} /> : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 xl:grid-cols-6">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => o.status === col || (col === 'out_for_delivery' && o.status === 'served'));
              return (
                <section key={col} className="min-w-[240px] flex-1 rounded-2xl bg-slate-100 p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">{ORDER_STATUS[col].en}</h2>
                    <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((o) => (
                      <button key={o.id} onClick={() => setActive(o)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{o.customer_name}</span>
                          <span className="text-xs font-semibold tabular-nums text-amber-700">{inr(o.total)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{o.ref} · {ORDER_TYPES[o.type]?.en || o.type}{o.table_no ? ` · T${o.table_no}` : ''}</p>
                        <p className="mt-1 text-xs text-slate-600">{(o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)} {L('items', 'आइटम')} · {new Date(o.created_date || o.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                        {NEXT[o.status] && ORDER_STATUS[NEXT[o.status]] && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); move(o, NEXT[o.status]); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); move(o, NEXT[o.status]); } }}
                            className="mt-2 block rounded-lg bg-slate-900 py-2 text-center text-xs font-semibold text-white"
                          >
                            → {ORDER_STATUS[NEXT[o.status]].en}
                          </span>
                        )}
                      </button>
                    ))}
                    {list.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{L('Empty', 'खाली')}</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">{L('Order', 'ऑर्डर')}</th><th className="px-4 py-3">{L('Customer', 'ग्राहक')}</th><th className="px-4 py-3">{L('Type', 'प्रकार')}</th><th className="px-4 py-3">{L('Total', 'कुल')}</th><th className="px-4 py-3">{L('Status', 'स्थिति')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setActive(o)}>
                  <td className="px-4 py-3"><span className="font-medium">{o.ref}</span><span className="block text-xs text-slate-500">{new Date(o.created_date || o.created_at || Date.now()).toLocaleDateString('en-IN')}</span></td>
                  <td className="px-4 py-3">{o.customer_name}<span className="block text-xs text-slate-500">{o.phone}</span></td>
                  <td className="px-4 py-3 capitalize">{o.type}</td>
                  <td className="px-4 py-3 tabular-nums">{inr(o.total)}</td>
                  <td className="px-4 py-3"><StatusPill kind="order" value={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{active.ref}</h2>
                <p className="text-xs text-slate-500">{new Date(active.created_date || active.created_at || Date.now()).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill kind="order" value={active.status} />
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${active.payment_status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{active.payment_status}</span>
              <a href={`tel:+91${active.phone}`} className="ml-auto flex items-center gap-1 text-xs font-semibold text-slate-600"><Phone size={14} />{active.phone}</a>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              <b>{active.customer_name}</b> · {ORDER_TYPES[active.type]?.en}
              {active.table_no ? ` · ${L('Table', 'टेबल')} ${active.table_no}` : ''}
              {active.address ? ` · ${active.address}` : ''}
            </p>

            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {(active.items || []).map((i, n) => (
                <li key={n} className="flex justify-between py-1.5"><span>{i.qty} × {i.name}</span><span className="tabular-nums">{inr(i.price * i.qty)}</span></li>
              ))}
            </ul>
            <div className="mt-2 space-y-0.5 rounded-lg bg-slate-50 p-2 text-sm">
              <p className="flex justify-between text-slate-500"><span>{L('Subtotal', 'सबटोटल')}</span><span>{inr(active.subtotal)}</span></p>
              <p className="flex justify-between text-slate-500"><span>{L('Tax', 'टैक्स')}</span><span>{inr(active.tax)}</span></p>
              {active.delivery > 0 && <p className="flex justify-between text-slate-500"><span>{L('Delivery', 'डिलीवरी')}</span><span>{inr(active.delivery)}</span></p>}
              <p className="flex justify-between font-bold"><span>{L('Total', 'कुल')}</span><span>{inr(active.total)}</span></p>
            </div>
            {active.notes && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{active.notes}</p>}

            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">{L('Move to', 'स्थिति बदलें')}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <button key={k} onClick={() => move(active, k)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${active.status === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{L(v.en, v.hi)}</button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => markPaid(active)} disabled={active.payment_status === 'paid'} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{active.payment_status === 'paid' ? L('Paid', 'भुगतान हुआ') : L('Mark paid', 'भुगतान हुआ')}</button>
              <button onClick={() => kot(active)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"><Printer size={15} />KOT</button>
              <button onClick={() => bill(active)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"><Printer size={15} />{L('Customer bill', 'ग्राहक बिल')}</button>
            </div>
          </div>
        </div>
      )}

      <OrderForm open={openForm} onClose={() => { setOpenForm(false); setParams({}); }} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-orders'] })} />
    </div>
  );
}
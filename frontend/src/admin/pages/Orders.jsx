import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
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
import {
  setOrdersData,
  setActiveOrder,
  updateOrderOptimistic,
} from '@/store/slices/ordersSlice';

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
  const [orderPriceModal, setOrderPriceModal] = useState({ open: false, total: '' });
  const [settings, setSettings] = useState(null);
  const qc = useQueryClient();
  const dispatch = useDispatch();

  const reduxOrders = useSelector((state) => state.orders.items);
  const isOrdersLoaded = useSelector((state) => state.orders.isLoaded);

  useEffect(() => { setOpenForm(params.get('new') === '1'); }, [params]);
  useEffect(() => { getSettings().then(setSettings); }, []);

  const { data: rawOrders = [], isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      try {
        const res = await apiClient.entities.Order.filter({}, { sort: '-created_date', limit: 200 });
        const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
        dispatch(setOrdersData(list));
        return list;
      } catch (err) {
        console.error('Failed to load admin orders:', err);
        return [];
      }
    },
    refetchInterval: 6000, // Automatically refresh live board every 6s
  });

  useEffect(() => {
    if (Array.isArray(rawOrders) && rawOrders.length > 0) {
      dispatch(setOrdersData(rawOrders));
    }
  }, [rawOrders, dispatch]);

  const orders = isOrdersLoaded ? reduxOrders : (Array.isArray(rawOrders) ? rawOrders : []);

  // Live board: safe listener if real-time subscription is supported
  useEffect(() => {
    if (typeof apiClient?.entities?.Order?.subscribe === 'function') {
      const unsub = apiClient.entities.Order.subscribe(() => qc.invalidateQueries({ queryKey: ['admin-orders'] }));
      return unsub;
    }
  }, [qc]);

  const move = async (order, status) => {
    // Instant optimistic status transition
    dispatch(updateOrderOptimistic({ id: order.id, status }));
    setActive((a) => (a && a.id === order.id ? { ...a, status } : a));

    try {
      await apiClient.entities.Order.update(order.id, { status });
      audit(me, 'status', 'orders', 'Order', order.id, `${order.ref}: ${order.status} → ${status}`).catch(() => {});
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err) {
      alert(err.message || 'Failed to update order status');
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    }
  };

  const markPaid = async (order) => {
    const payment_mode = order.payment_mode === 'none' ? 'cash' : order.payment_mode;
    // Instant optimistic payment update
    dispatch(updateOrderOptimistic({ id: order.id, payment_status: 'paid', payment_mode }));
    setActive((a) => (a && a.id === order.id ? { ...a, payment_status: 'paid', payment_mode } : a));

    try {
      await apiClient.entities.Order.update(order.id, { payment_status: 'paid', payment_mode });
      audit(me, 'payment', 'orders', 'Order', order.id, `${order.ref} marked paid`).catch(() => {});
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err) {
      alert(err.message || 'Failed to update payment status');
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    }
  };

  const handleOrderPriceUpdate = async (e) => {
    e.preventDefault();
    const newTotal = Number(orderPriceModal.total);
    if (isNaN(newTotal) || newTotal < 0) {
      alert(L('Please enter a valid amount', 'कृपया सही राशि डालें'));
      return;
    }

    // 1. Instant optimistic update to Redux store
    dispatch(updateOrderOptimistic({ id: active.id, total: newTotal, total_amount: newTotal }));

    // 2. Instant update in local active modal state
    setActive((prev) => prev ? { ...prev, total: newTotal, total_amount: newTotal } : prev);

    // 3. Instant update in React Query cache
    qc.setQueryData(['admin-orders'], (old) => {
      const list = Array.isArray(old?.items) ? old.items : (Array.isArray(old) ? old : []);
      const updated = list.map((item) => (item.id === active.id ? { ...item, total: newTotal, total_amount: newTotal } : item));
      return Array.isArray(old?.items) ? { ...old, items: updated } : updated;
    });

    setOrderPriceModal({ open: false, total: '' });

    // 4. Save to backend asynchronously
    try {
      await apiClient.entities.Order.update(active.id, { total: newTotal, total_amount: newTotal });
      audit(me, 'update_price', 'orders', 'Order', active.id, `Updated total of ${active.ref} to ₹${newTotal}`).catch(() => {});
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (err) {
      alert(err.message || 'Failed to update order price');
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    }
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
          <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0 xl:grid xl:grid-cols-6 xl:overflow-x-auto">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => o.status === col || (col === 'out_for_delivery' && o.status === 'served'));
              return (
                <section key={col} className="min-w-[220px] flex-1 rounded-2xl bg-slate-100 p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">{ORDER_STATUS[col]?.en || col}</h2>
                    <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setActive(o)}
                        className="group w-full min-w-0 box-border rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
                      >
                        {/* Top Meta: Ref Badge + Order Type Pill */}
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <span
                            className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 truncate"
                            title={o.ref}
                          >
                            {o.ref.startsWith('ORD-') ? `#${o.ref.slice(9)}` : o.ref}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              o.type === 'dine_in'
                                ? 'bg-sky-50 text-sky-700 border-sky-200/70'
                                : o.type === 'pickup'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            }`}
                          >
                            {ORDER_TYPES[o.type]?.en || o.type || 'Order'}{o.table_no ? ` · T${o.table_no}` : ''}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="mt-2 min-w-0">
                          <span
                            className="block truncate text-sm font-bold text-slate-900 leading-snug group-hover:text-amber-800 transition-colors"
                            title={o.customer_name || 'Customer'}
                          >
                            {o.customer_name || 'Customer'}
                          </span>
                          {o.phone && (
                            <span className="block truncate text-[11px] text-slate-400 font-medium mt-0.5">
                              {o.phone}
                            </span>
                          )}
                        </div>

                        {/* Total Amount Row (Distinct High-Visibility Box) */}
                        <div className="mt-2 flex items-center justify-between min-w-0 rounded-lg bg-amber-50/70 px-2.5 py-1.5 border border-amber-200/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/75">{L('Total', 'कुल')}</span>
                          <span className="shrink-0 whitespace-nowrap text-xs font-black tabular-nums text-amber-700">
                            {inr(o.total)}
                          </span>
                        </div>

                        {/* Items & Timestamp */}
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                          <span className="flex items-center gap-1 font-semibold text-slate-600">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {(o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)} {L('items', 'आइटम')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(o.created_date || o.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Action Step Button */}
                        {NEXT[o.status] && ORDER_STATUS[NEXT[o.status]] && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); move(o, NEXT[o.status]); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); move(o, NEXT[o.status]); } }}
                            className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-900 py-2 px-2 text-center text-xs font-bold text-white shadow-xs transition hover:bg-amber-600 active:scale-[0.98]"
                          >
                            <span>→</span>
                            <span className="truncate">{ORDER_STATUS[NEXT[o.status]]?.en || NEXT[o.status]}</span>
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
              <div className="flex justify-between items-center font-bold">
                <span>{L('Total', 'कुल')}</span>
                <span className="flex items-center gap-1.5">
                  <span>{inr(active.total)}</span>
                  <button
                    type="button"
                    onClick={() => setOrderPriceModal({ open: true, total: String(active.total || 0) })}
                    className="text-xs font-semibold text-amber-700 underline hover:text-amber-800 ml-1"
                  >
                    {L('Edit', 'बदलें')}
                  </button>
                </span>
              </div>
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

      {/* Edit Order Total Price Modal */}
      {orderPriceModal.open && active && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleOrderPriceUpdate}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900">{L('Edit Order Total', 'ऑर्डर की कुल कीमत बदलें')}</h3>
              <button
                type="button"
                onClick={() => setOrderPriceModal({ open: false, total: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {L('Order Total Amount (₹)', 'ऑर्डर की कुल राशि (₹)')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={orderPriceModal.total}
                onChange={(e) => setOrderPriceModal((prev) => ({ ...prev, total: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-base font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
              <p className="text-[11px] text-slate-400">
                {L('Order: ', 'ऑर्डर: ')} {active.ref} · {active.customer_name}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderPriceModal({ open: false, total: '' })}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {L('Cancel', 'रद्द')}
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition"
              >
                {L('Update Price', 'कीमत अपडेट करें')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
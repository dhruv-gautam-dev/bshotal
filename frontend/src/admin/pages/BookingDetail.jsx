import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, MessageCircle, Printer, CheckCircle2, LogIn, LogOut, XCircle, Trash2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import {
  getSettings, checkAvailability, audit, inr, money, printHtml, todayISO, nightsBetween,
} from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Confirm from '../components/Confirm';

export default function BookingDetail() {
  const { id } = useParams();
  const { L } = useI18n();
  const { me } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ open: false, amount: '', mode: 'cash', kind: 'balance', note: '' });
  const [edit, setEdit] = useState(null);
  const [notes, setNotes] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-booking', id],
    queryFn: async () => {
      // Payments are owner/manager only — staff still see the booking itself.
      const [booking, payments, settings] = await Promise.all([
        base44.entities.Booking.get(id),
        me?.staff_role === 'staff'
          ? Promise.resolve({ items: [] })
          : base44.entities.Payment.filter({ booking_id: id }, { sort: '-created_date', limit: 50 }),
        getSettings(),
      ]);
      return { booking, payments: payments.items || [], settings };
    },
  });

  const b = data?.booking;
  const isStaff = me?.staff_role === 'staff';
  const canDelete = !isStaff;

  const save = async (patch, log) => {
    setBusy(true);
    setErr('');
    try {
      await base44.entities.Booking.update(id, patch);
      await audit(me, 'update', 'bookings', 'Booking', id, log);
      await refetch();
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    } catch (ex) {
      setErr(ex.message || L('Could not update the booking.', 'बुकिंग अपडेट नहीं हुई।'));
    } finally { setBusy(false); }
  };

  const setStatus = (status, label) => save({
    status,
    history: [...(b.history || []), { status, at: new Date().toISOString(), by: me?.email || 'staff' }],
  }, label);

  const checkIn = async () => {
    setBusy(true);
    try {
      const rooms = await base44.entities.Room.filter({ room_type_id: b.room_type_id, is_active: true }, { limit: 50 });
      const free = (rooms.items || []).find((r) => r.status !== 'occupied' && r.status !== 'maintenance');
      if (free) await base44.entities.Room.update(free.id, { status: 'occupied' });
      await save({
        status: 'checked_in',
        room_id: free?.id || b.room_id || '',
        room_number: free?.number || b.room_number || '',
        history: [...(b.history || []), { status: 'checked_in', at: new Date().toISOString(), by: me?.email || 'staff' }],
      }, `Checked in ${b.guest_name}`);
    } finally { setBusy(false); }
  };

  const checkOut = async () => {
    if (b.room_id) {
      await base44.entities.Room.update(b.room_id, { status: 'cleaning' }).catch(() => {});
    }
    await setStatus('checked_out', `Checked out ${b.guest_name}`);
  };

  const cancel = async () => {
    await save({
      status: 'cancelled',
      cancel_reason: document.getElementById('cancel-reason')?.value || '',
      history: [...(b.history || []), { status: 'cancelled', at: new Date().toISOString(), by: me?.email || 'staff' }],
    }, `Cancelled ${b.guest_name}`);
    setCancelOpen(false);
  };

  const remove = async () => {
    await base44.entities.Booking.delete(id);
    await audit(me, 'delete', 'bookings', 'Booking', id, `Deleted booking ${b.ref}`);
    navigate('/admin/bookings');
  };

  const addPayment = async (e) => {
    e.preventDefault();
    const amount = money(pay.amount);
    if (amount <= 0) return;
    setBusy(true);
    try {
      await base44.entities.Payment.create({
        booking_id: id, amount, mode: pay.mode, kind: pay.kind, note: pay.note, paid_at: todayISO(), received_by: me?.email || '',
      });
      const paid = money(b.advance_paid) + (pay.kind === 'refund' ? -amount : amount);
      await base44.entities.Booking.update(id, {
        advance_paid: paid,
        balance: Math.max(0, money(b.amount) - paid),
        payment_mode: pay.mode,
      });
      await audit(me, 'payment', 'bookings', 'Booking', id, `Payment ${inr(amount)} (${pay.mode}) for ${b.ref}`);
      setPay({ open: false, amount: '', mode: 'cash', kind: 'balance', note: '' });
      await refetch();
    } finally { setBusy(false); }
  };

  const saveDates = async () => {
    const nights = nightsBetween(edit.check_in, edit.check_out);
    if (nights <= 0) { setErr(L('Check-out must be after check-in.', 'चेक-आउट चेक-इन के बाद होना चाहिए।')); return; }
    const avail = await checkAvailability(b.room_type_id, edit.check_in, edit.check_out, b.id);
    if (avail.available <= 0) { setErr(L('No room free for those dates.', 'इन तारीखों में कमरा खाली नहीं।')); return; }
    await save({ ...edit, nights }, `Dates changed for ${b.ref}`);
    setEdit(null);
  };

  const invoice = () => {
    const s = data.settings || {};
    const rows = [
      ['Guest', b.guest_name], ['Mobile', b.phone], ['Room', `${b.room_type_name}${b.room_number ? ` · ${b.room_number}` : ''}`],
      ['Check-in', b.check_in], ['Check-out', b.check_out], ['Nights', b.nights], ['Guests', b.guests],
    ];
    printHtml(`Invoice ${b.ref}`, `
      <h1>${s.hotel_name || 'B.S. Hotel & Delicee Restaurant'}</h1>
      <p class="muted">${s.address_en || ''}<br/>${s.phone_primary || ''}${s.gst ? ` · GSTIN ${s.gst}` : ''}</p>
      <h2>Booking ${b.ref} <span class="tag">${b.status}</span></h2>
      <table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v ?? ''}</td></tr>`).join('')}</table>
      <h2>Payment</h2>
      <table>
        <tr><td>Total</td><td class="r">${inr(b.amount)}</td></tr>
        <tr><td>Advance paid</td><td class="r">${inr(b.advance_paid)}</td></tr>
        <tr><td class="total">Balance</td><td class="r total">${inr(b.balance)}</td></tr>
      </table>
      ${(data.payments || []).length ? `<h2>Payments</h2><table>${data.payments.map((p) => `<tr><td>${p.paid_at || ''} · ${p.mode} (${p.kind})</td><td class="r">${inr(p.amount)}</td></tr>`).join('')}</table>` : ''}
      <p class="muted" style="margin-top:24px">${s.cancellation_policy || ''}</p>
    `);
  };

  if (isLoading || !b) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />;

  const wa = `https://wa.me/91${b.phone}?text=${encodeURIComponent(`Namaste ${b.guest_name}, this is B.S. Hotel regarding your booking ${b.ref} (${b.check_in} to ${b.check_out}).`)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate('/admin/bookings')} className="flex items-center gap-1 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />{L('Bookings', 'बुकिंग')}</button>
        <div className="flex gap-2">
          <a href={`tel:+91${b.phone}`} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Phone size={15} />{L('Call', 'कॉल')}</a>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><MessageCircle size={15} />WhatsApp</a>
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{b.guest_name}</h1>
            <p className="text-sm text-slate-500">{b.phone} · {b.ref} · {b.source}</p>
          </div>
          <StatusPill kind="booking" value={b.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-slate-500">{L('Check-in', 'चेक-इन')}</dt><dd className="font-medium">{b.check_in}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Check-out', 'चेक-आउट')}</dt><dd className="font-medium">{b.check_out}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Room', 'कमरा')}</dt><dd className="font-medium">{b.room_type_name}{b.room_number ? ` · ${b.room_number}` : ''}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Guests', 'मेहमान')}</dt><dd className="font-medium">{b.guests} · {b.nights} {L('nights', 'रात')}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Total', 'कुल')}</dt><dd className="font-medium">{inr(b.amount)}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Advance', 'एडवांस')}</dt><dd className="font-medium">{inr(b.advance_paid)}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Balance', 'बाकी')}</dt><dd className="font-semibold text-amber-700">{inr(b.balance)}</dd></div>
          <div><dt className="text-xs text-slate-500">{L('Payment mode', 'भुगतान')}</dt><dd className="font-medium capitalize">{b.payment_mode}</dd></div>
        </dl>

        {b.special_requests && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><b>{L('Requests', 'अनुरोध')}:</b> {b.special_requests}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {b.status === 'pending' && <button onClick={() => setStatus('confirmed', `Confirmed ${b.ref}`)} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={15} />{L('Confirm', 'कन्फ़र्म')}</button>}
          {['pending', 'confirmed'].includes(b.status) && <button onClick={checkIn} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white"><LogIn size={15} />{L('Check in', 'चेक-इन')}</button>}
          {b.status === 'checked_in' && <button onClick={checkOut} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"><LogOut size={15} />{L('Check out', 'चेक-आउट')}</button>}
          {!isStaff && <button onClick={() => setPay({ ...pay, open: true })} className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Plus size={15} />{L('Payment', 'भुगतान')}</button>}
          <button onClick={invoice} className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Printer size={15} />{L('Invoice', 'बिल')}</button>
          {!isStaff && ['pending', 'confirmed'].includes(b.status) && <button onClick={() => setCancelOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700"><XCircle size={15} />{L('Cancel', 'रद्द')}</button>}
          {canDelete && <button onClick={() => setDelOpen(true)} className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500"><Trash2 size={15} /></button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">{L('Notes', 'नोट्स')}</h2>
          <textarea
            rows={3}
            value={notes ?? b.notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-amber-500"
            placeholder={L('Internal notes about this guest', 'इस मेहमान के बारे में नोट्स')}
          />
          <button onClick={() => save({ notes }, `Note added to ${b.ref}`).then(() => setNotes(null))} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{L('Save note', 'नोट सेव करें')}</button>

          <h2 className="mb-2 mt-5 font-semibold text-slate-900">{L('Change dates', 'तारीखें बदलें')}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">{L('In', 'से')}<input type="date" defaultValue={b.check_in} onChange={(e) => setEdit({ ...(edit || {}), check_in: e.target.value })} className="mt-1 block rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label>
            <label className="text-xs text-slate-500">{L('Out', 'तक')}<input type="date" defaultValue={b.check_out} onChange={(e) => setEdit({ ...(edit || {}), check_out: e.target.value })} className="mt-1 block rounded-lg border border-slate-300 px-2 py-2 text-sm" /></label>
            <button onClick={saveDates} disabled={!edit?.check_in || !edit?.check_out} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{L('Update', 'अपडेट')}</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">{L('History', 'इतिहास')}</h2>
          <ol className="space-y-2 text-sm">
            {(b.history || []).map((h, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="font-medium capitalize text-slate-700">{h.status?.replace('_', ' ')}</span>
                <span className="text-xs text-slate-500">{new Date(h.at).toLocaleString('en-IN')} · {h.by}</span>
              </li>
            ))}
            {(b.history || []).length === 0 && <li className="text-slate-500">{L('No changes yet.', 'अभी कोई बदलाव नहीं।')}</li>}
          </ol>
          {data.payments.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{L('Payments', 'भुगतान')}</h3>
              <ul className="mt-1 text-sm text-slate-600">
                {data.payments.map((p) => <li key={p.id} className="flex justify-between border-b border-slate-100 py-1"><span>{p.paid_at} · {p.mode} · {p.kind}</span><span className="tabular-nums">{inr(p.amount)}</span></li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      {pay.open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <form onSubmit={addPayment} className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="mb-3 font-semibold text-slate-900">{L('Record payment', 'भुगतान दर्ज करें')}</h2>
            <label className="block text-sm">{L('Amount', 'राशि')}<input type="number" min="1" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-sm">{L('Mode', 'माध्यम')}
                <select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                  <option value="cash">{L('Cash', 'नकद')}</option><option value="upi">UPI</option><option value="card">{L('Card', 'कार्ड')}</option><option value="online">{L('Online', 'ऑनलाइन')}</option>
                </select>
              </label>
              <label className="text-sm">{L('Type', 'प्रकार')}
                <select value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                  <option value="advance">{L('Advance', 'एडवांस')}</option><option value="balance">{L('Balance', 'बाकी')}</option><option value="refund">{L('Refund', 'वापसी')}</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPay({ ...pay, open: false })} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold">{L('Close', 'बंद')}</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Save', 'सेव')}</button>
            </div>
          </form>
        </div>
      )}

      <Confirm open={cancelOpen} title={L('Cancel this booking?', 'यह बुकिंग रद्द करें?')} message={<input id="cancel-reason" placeholder={L('Reason (optional)', 'कारण (वैकल्पिक)')} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />} confirmLabel={L('Cancel booking', 'बुकिंग रद्द करें')} onConfirm={cancel} onCancel={() => setCancelOpen(false)} />
      <Confirm open={delOpen} title={L('Delete permanently?', 'हमेशा के लिए मिटाएँ?')} message={L('This removes the booking and cannot be undone.', 'यह बुकिंग हट जाएगी और वापस नहीं आएगी।')} onConfirm={remove} onCancel={() => setDelOpen(false)} />
    </div>
  );
}
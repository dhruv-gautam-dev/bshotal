import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Save, UserPlus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { getSettings, saveSettings, audit } from '../lib/adminData';
import { updateSettingsOptimistic } from '@/store/slices/settingsSlice';

const HOTEL = [
  ['hotel_name', 'Hotel name', 'होटल का नाम'], ['tagline_en', 'Tagline (English)', 'टैगलाइन (अंग्रेज़ी)'],
  ['tagline_hi', 'Tagline (Hindi)', 'टैगलाइन (हिन्दी)'], ['phone_primary', 'Primary phone', 'मुख्य फ़ोन'],
  ['phone_secondary', 'Second phone', 'दूसरा फ़ोन'], ['whatsapp', 'WhatsApp number', 'व्हाट्सएप नंबर'],
  ['owner_email', 'Owner email (alerts)', 'मालिक ईमेल'], ['address_en', 'Address (English)', 'पता (अंग्रेज़ी)'],
  ['address_hi', 'Address (Hindi)', 'पता (हिन्दी)'], ['hours_en', 'Hours (English)', 'समय (अंग्रेज़ी)'],
  ['hours_hi', 'Hours (Hindi)', 'समय (हिन्दी)'], ['fssai', 'FSSAI licence', 'FSSAI लाइसेंस'],
  ['gst', 'GST number', 'GST नंबर'], ['logo_url', 'Logo URL', 'लोगो URL'],
];

const OPS = [
  ['tax_percent', 'Tax %', 'टैक्स %'], ['delivery_charge', 'Delivery charge ₹', 'डिलीवरी शुल्क ₹'],
  ['delivery_radius_km', 'Delivery radius (km)', 'डिलीवरी दायरा (किमी)'], ['min_order', 'Minimum order ₹', 'न्यूनतम ऑर्डर ₹'],
  ['advance_percent', 'Booking advance %', 'बुकिंग एडवांस %'], ['checkin_time', 'Check-in time', 'चेक-इन समय'],
  ['checkout_time', 'Check-out time', 'चेक-आउट समय'],
];

export default function SettingsAdmin() {
  const { L } = useI18n();
  const { me, can } = useAdmin();
  const isOwner = me?.staff_role === 'owner';
  const dispatch = useDispatch();
  const [tab, setTab] = useState('hotel');
  const [form, setForm] = useState(null);
  const [invite, setInvite] = useState({ email: '', role: 'staff' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const settings = await getSettings();
      let users = [];
      let logs = [];
      if (isOwner) {
        try { users = await apiClient.entities.User.list(); } catch { users = []; }
        try { logs = (await apiClient.entities.AuditLog.filter({}, { sort: '-created_date', limit: 100 })).items; } catch { logs = []; }
      }
      return { settings, users: Array.isArray(users) ? users : [], logs };
    },
    enabled: can('settings'),
  });

  useEffect(() => {
    if (data) setForm({ hotel_name: 'B.S. Hotel & Delicee Restaurant', tax_percent: 0, delivery_charge: 0, checkin_time: '12:00', checkout_time: '10:00', notify_email: true, ...(data.settings || {}) });
  }, [data]);

  const save = async () => {
    const payload = { ...form };
    ['id', 'created_date', 'updated_date', 'created_by_id'].forEach((k) => delete payload[k]);
    dispatch(updateSettingsOptimistic(payload));
    setMsg(L('Saved.', 'सेव हो गया।'));
    setSaving(true);
    try {
      await saveSettings(data?.settings?.id, payload);
      audit(me, 'save', 'settings', 'Setting', data?.settings?.id || '', 'Business settings updated').catch(() => {});
      refetch();
    } catch (err) {
      alert(err.message || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  const setRole = async (user, role) => {
    await apiClient.entities.User.update(user.id, { staff_role: role, staff_active: true });
    await audit(me, 'staff', 'settings', 'User', user.id, `${user.email} → ${role}`);
    refetch();
  };

  const toggleActive = async (user) => {
    await apiClient.entities.User.update(user.id, { staff_active: user.staff_active === false });
    await audit(me, 'staff', 'settings', 'User', user.id, `${user.email} active=${user.staff_active === false}`);
    refetch();
  };

  const deleteStaff = async (user) => {
    if (!window.confirm(L(`Remove staff account for ${user.email}?`, `क्या आप ${user.email} का स्टाफ खाता हटाना चाहते हैं?`))) return;
    await apiClient.entities.User.delete(user.id);
    await audit(me, 'staff_delete', 'settings', 'User', user.id, `Removed ${user.email}`);
    refetch();
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setMsg('');
    const cleanEmail = (invite.email || '').trim().toLowerCase();
    if (!cleanEmail) return;
    try {
      if (apiClient.users?.inviteUser) {
        await apiClient.users.inviteUser(cleanEmail, invite.role);
      }
      const allUsers = await apiClient.entities.User.list();
      let found = (Array.isArray(allUsers) ? allUsers : []).find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );
      if (found) {
        await apiClient.entities.User.update(found.id, { staff_role: invite.role, staff_active: true });
      } else {
        found = await apiClient.entities.User.create({
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0],
          role: invite.role === 'owner' ? 'admin' : 'staff',
          staff_role: invite.role,
          staff_active: true,
        });
      }
      await audit(me, 'staff', 'settings', 'User', found?.id || '', `Invited ${cleanEmail} as ${invite.role}`);
      setMsg(L('Invite sent. Staff member added successfully.', 'आमंत्रण भेज दिया। स्टाफ सदस्य सफलतापूर्वक जोड़ा गया।'));
      setInvite({ email: '', role: 'staff' });
      refetch();
    } catch (ex) {
      setMsg(ex.message || L('Could not send the invite.', 'आमंत्रण नहीं भेजा जा सका।'));
    }
  };

  if (!can('settings') || !form) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{L('Only the owner can open settings.', 'केवल मालिक सेटिंग्स खोल सकते हैं।')}</div>;
  }

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';
  const tabs = [['hotel', L('Hotel profile', 'होटल प्रोफ़ाइल')], ['operations', L('Operations', 'संचालन')], ['staff', L('Staff accounts', 'स्टाफ खाते')], ['audit', L('Audit log', 'ऑडिट लॉग')]];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{L('Settings', 'सेटिंग्स')}</h1>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-2 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {tab === 'hotel' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {HOTEL.map(([key, en, hi]) => (
              <label key={key} className="text-sm font-medium text-slate-700">{L(en, hi)}<input className={input} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{L('Save changes', 'सेव करें')}</button>
        </div>
      )}

      {tab === 'operations' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {OPS.map(([key, en, hi]) => (
              <label key={key} className="text-sm font-medium text-slate-700">{L(en, hi)}
                <input className={input} type={['checkin_time', 'checkout_time'].includes(key) ? 'time' : 'number'} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">{L('Cancellation policy', 'रद्द करने की नीति')}
              <textarea rows={3} className={input} value={form.cancellation_policy || ''} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={form.notify_email !== false} onChange={(e) => setForm({ ...form, notify_email: e.target.checked })} />{L('Email the owner about new bookings / orders', 'नई बुकिंग / ऑर्डर पर मालिक को ईमेल')}</label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">{L('WhatsApp / SMS webhook (for later)', 'व्हाट्सएप / SMS वेबहुक (बाद के लिए)')}
              <input className={input} value={form.notify_whatsapp_hook || ''} onChange={(e) => setForm({ ...form, notify_whatsapp_hook: e.target.value })} placeholder="https://…" />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">{L('Email alerts are sent by the platform once an owner email is set. Delivery to outside addresses needs a connected custom domain.', 'मालिक ईमेल सेट होने पर प्लेटफ़ॉर्म ईमेल भेजता है। बाहरी पते पर डिलीवरी के लिए कस्टम डोमेन ज़रूरी है।')}</p>
          <button onClick={save} disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{L('Save changes', 'सेव करें')}</button>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-3">
          <form onSubmit={sendInvite} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold text-slate-900">{L('Invite a staff member', 'स्टाफ सदस्य आमंत्रित करें')}</h2>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 text-sm">{L('Email', 'ईमेल')}<input type="email" required className={input} value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
              <label className="text-sm">{L('Role', 'भूमिका')}
                <select className={input} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  <option value="manager">{L('Manager', 'मैनेजर')}</option>
                  <option value="staff">{L('Staff', 'स्टाफ')}</option>
                  <option value="owner">{L('Owner', 'मालिक')}</option>
                </select>
              </label>
              <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><UserPlus size={15} />{L('Send invite', 'आमंत्रण भेजें')}</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{L('The invitee sets their own password from the email link. Nobody can see another person’s password.', 'आमंत्रित सदस्य ईमेल लिंक से अपना पासवर्ड सेट करते हैं। कोई दूसरे का पासवर्ड नहीं देख सकता।')}</p>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{L('Account', 'खाता')}</th>
                  <th className="px-4 py-3">{L('Role', 'भूमिका')}</th>
                  <th className="px-4 py-3">{L('Access', 'पहुँच')}</th>
                  <th className="px-4 py-3 text-right">{L('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.users || []).map((u) => {
                  const role = u.role === 'admin' ? 'owner' : (u.staff_role || 'none');
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3"><p className="font-medium text-slate-900">{u.full_name || u.email}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                      <td className="px-4 py-3">
                        <select value={role} disabled={u.id === me?.id} onChange={(e) => setRole(u, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold disabled:opacity-50">
                          <option value="owner">{L('Owner', 'मालिक')}</option>
                          <option value="manager">{L('Manager', 'मैनेजर')}</option>
                          <option value="staff">{L('Staff', 'स्टाफ')}</option>
                          <option value="none">{L('No access', 'पहुँच नहीं')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(u)} disabled={u.id === me?.id} className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${u.staff_active === false ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                          {u.staff_active === false ? L('Blocked', 'अवरुद्ध') : L('Active', 'सक्रिय')}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== me?.id && (
                          <button
                            type="button"
                            onClick={() => deleteStaff(u)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title={L('Remove user', 'उपयोगकर्ता हटाएं')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {(data?.logs || []).length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{L('No activity recorded yet.', 'अभी कोई गतिविधि दर्ज नहीं।')}</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.logs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div><p className="text-slate-800">{l.summary}</p><p className="text-xs text-slate-500">{l.actor_email} · {l.actor_role} · {l.area}/{l.action}</p></div>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(l.created_date).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} />{L('Passwords are handled by the platform — use “Forgot password” to reset yours.', 'पासवर्ड प्लेटफ़ॉर्म संभालता है — अपना पासवर्ड बदलने के लिए “पासवर्ड भूल गए” दबाएँ।')}</p>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { ROOM_STATUS, audit, inr, money, todayISO } from '../lib/adminData';
import AvailabilityCalendar from './AvailabilityCalendar';
import Empty from '../components/Empty';

const blankType = { name_en: '', name_hi: '', desc_en: '', price: '', capacity: 2, total_rooms: 1, amenities: '', images: '' };

export default function RoomsAdmin() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'types');
  const [typeForm, setTypeForm] = useState(null);
  const [roomForm, setRoomForm] = useState({ open: false, number: '', room_type_id: '', floor: '' });
  const [blockForm, setBlockForm] = useState({ room_type_id: '', start_date: todayISO(), end_date: '', reason: '' });
  const [ruleForm, setRuleForm] = useState({ room_type_id: '', start_date: '', end_date: '', price: '', label: '' });
  const qc = useQueryClient();

  useEffect(() => { const t = params.get('tab'); if (t) setTab(t); }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-rooms'],
    queryFn: async () => {
      const [types, rooms, bookings, blocks, rules] = await Promise.all([
        apiClient.entities.RoomType.filter({}, { sort: 'sort', limit: 100 }),
        apiClient.entities.Room.filter({}, { sort: 'number', limit: 200 }),
        apiClient.entities.Booking.filter({}, { sort: 'check_in', limit: 300 }),
        apiClient.entities.BlockedDate.filter({}, { sort: '-start_date', limit: 100 }),
        apiClient.entities.PricingRule.filter({}, { sort: '-start_date', limit: 100 }),
      ]);
      return { types: types.items, rooms: rooms.items, bookings: bookings.items, blocks: blocks.items, rules: rules.items };
    },
  });

  const types = data?.types || [];
  const rooms = data?.rooms || [];
  const bookings = data?.bookings || [];
  const blocks = data?.blocks || [];
  const rules = data?.rules || [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-rooms'] }); qc.invalidateQueries({ queryKey: ['public-rooms'] }); };

  const saveType = async (e) => {
    e.preventDefault();
    const payload = {
      ...typeForm,
      price: money(typeForm.price),
      capacity: Number(typeForm.capacity) || 2,
      total_rooms: Number(typeForm.total_rooms) || 1,
      amenities: String(typeForm.amenities || '').split(',').map((s) => s.trim()).filter(Boolean),
      images: String(typeForm.images || '').split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (payload.id) await apiClient.entities.RoomType.update(payload.id, payload);
    else await apiClient.entities.RoomType.create(payload);
    await audit(me, 'save', 'rooms', 'RoomType', payload.id || '', `${payload.name_en} ₹${payload.price}`);
    setTypeForm(null);
    refresh();
  };

  const addRoom = async (e) => {
    e.preventDefault();
    await apiClient.entities.Room.create({ number: roomForm.number, room_type_id: roomForm.room_type_id, floor: roomForm.floor, status: 'available', is_active: true });
    setRoomForm({ open: false, number: '', room_type_id: '', floor: '' });
    refresh();
  };

  const setRoomStatus = async (room, status) => {
    await apiClient.entities.Room.update(room.id, { status });
    await audit(me, 'status', 'rooms', 'Room', room.id, `Room ${room.number} → ${status}`);
    refresh();
  };

  const addBlock = async (e) => {
    e.preventDefault();
    if (!blockForm.room_type_id || !blockForm.start_date || !blockForm.end_date) return;
    await apiClient.entities.BlockedDate.create(blockForm);
    await audit(me, 'block', 'rooms', 'BlockedDate', '', `${blockForm.start_date} → ${blockForm.end_date}`);
    setBlockForm({ ...blockForm, end_date: '', reason: '' });
    refresh();
  };

  const addRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.room_type_id || !ruleForm.start_date || !ruleForm.end_date || !ruleForm.price) return;
    await apiClient.entities.PricingRule.create({ ...ruleForm, price: money(ruleForm.price) });
    await audit(me, 'price', 'rooms', 'PricingRule', '', `${ruleForm.start_date} → ${ruleForm.end_date} ₹${ruleForm.price}`);
    setRuleForm({ room_type_id: '', start_date: '', end_date: '', price: '', label: '' });
    refresh();
  };

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';
  const tabs = [['types', L('Room types', 'कमरे के प्रकार')], ['rooms', L('Room numbers', 'कमरे')], ['calendar', L('Availability', 'उपलब्धता')], ['blocks', L('Blocks & pricing', 'ब्लॉक और कीमत')]];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{L('Rooms & availability', 'कमरे और उपलब्धता')}</h1>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setParams(k === 'types' ? {} : { tab: k }); }} className={`whitespace-nowrap rounded-lg px-3 py-2 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" /> : (
        <>
          {tab === 'types' && (
            <div className="space-y-3">
              <button onClick={() => setTypeForm({ ...blankType })} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('Add room type', 'कमरे का प्रकार जोड़ें')}</button>
              {types.length === 0 ? <Empty title={L('No room types', 'कोई कमरा प्रकार नहीं')} hint={L('Add your first room type to start taking bookings.', 'बुकिंग शुरू करने के लिए पहला कमरा प्रकार जोड़ें।')} /> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {types.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{t.name_en}</p>
                          <p className="text-xs text-slate-500">{t.name_hi} · {t.capacity} {L('guests', 'मेहमान')} · {t.total_rooms} {L('rooms', 'कमरे')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-amber-700">{inr(t.price)}</p>
                          <p className="text-[11px] text-slate-400">/{L('night', 'रात')}</p>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.desc_en}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setTypeForm({ ...t, amenities: (t.amenities || []).join(', '), images: (t.images || []).join(', ') })} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"><Pencil size={12} />{L('Edit', 'संपादित')}</button>
                        {me?.staff_role === 'owner' && <button onClick={async () => { await apiClient.entities.RoomType.update(t.id, { is_active: !t.is_active }); refresh(); }} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${t.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>{t.is_active ? L('Active', 'सक्रिय') : L('Hidden', 'छिपा')}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'rooms' && (
            <div className="space-y-3">
              <button onClick={() => setRoomForm({ open: true, number: '', room_type_id: types[0]?.id || '', floor: '' })} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('Add room number', 'कमरा नंबर जोड़ें')}</button>
              {rooms.length === 0 ? <Empty title={L('No room numbers yet', 'अभी कमरा नंबर नहीं')} hint={L('Optional — add them to assign guests to exact rooms.', 'वैकल्पिक — मेहमान को सटीक कमरा देने के लिए जोड़ें।')} /> : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                      <div>
                        <p className="font-semibold text-slate-900">{L('Room', 'कमरा')} {r.number}</p>
                        <p className="text-xs text-slate-500">{types.find((t) => t.id === r.room_type_id)?.name_en || '—'}</p>
                      </div>
                      <select value={r.status} onChange={(e) => setRoomStatus(r, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold">
                        {Object.entries(ROOM_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'calendar' && <AvailabilityCalendar roomTypes={types.filter((t) => t.is_active !== false)} bookings={bookings} blocks={blocks} />}

          {tab === 'blocks' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-2 font-semibold text-slate-900">{L('Block dates', 'तारीखें बंद करें')}</h2>
                <form onSubmit={addBlock} className="space-y-2">
                  <select value={blockForm.room_type_id} onChange={(e) => setBlockForm({ ...blockForm, room_type_id: e.target.value })} className={input} required>
                    <option value="">{L('Room type', 'कमरे का प्रकार')}</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-500">{L('From', 'से')}<input type="date" className={input} value={blockForm.start_date} onChange={(e) => setBlockForm({ ...blockForm, start_date: e.target.value })} required /></label>
                    <label className="text-xs text-slate-500">{L('Until', 'तक')}<input type="date" className={input} value={blockForm.end_date} onChange={(e) => setBlockForm({ ...blockForm, end_date: e.target.value })} required /></label>
                  </div>
                  <input className={input} placeholder={L('Reason (maintenance, private event)', 'कारण (मरम्मत, निजी कार्यक्रम)')} value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                  <button className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Block these dates', 'तारीखें बंद करें')}</button>
                </form>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {blocks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2">
                      <span>{b.start_date} → {b.end_date} <span className="block text-xs text-slate-500">{types.find((t) => t.id === b.room_type_id)?.name_en} {b.reason ? `· ${b.reason}` : ''}</span></span>
                      <button onClick={async () => { await apiClient.entities.BlockedDate.delete(b.id); refresh(); }} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
                    </li>
                  ))}
                  {blocks.length === 0 && <li className="py-2 text-slate-500">{L('No blocked dates.', 'कोई तारीख बंद नहीं।')}</li>}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-2 font-semibold text-slate-900">{L('Seasonal pricing', 'मौसमी कीमत')}</h2>
                <form onSubmit={addRule} className="space-y-2">
                  <select value={ruleForm.room_type_id} onChange={(e) => setRuleForm({ ...ruleForm, room_type_id: e.target.value })} className={input} required>
                    <option value="">{L('Room type', 'कमरे का प्रकार')}</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-500">{L('From', 'से')}<input type="date" className={input} value={ruleForm.start_date} onChange={(e) => setRuleForm({ ...ruleForm, start_date: e.target.value })} required /></label>
                    <label className="text-xs text-slate-500">{L('Until', 'तक')}<input type="date" className={input} value={ruleForm.end_date} onChange={(e) => setRuleForm({ ...ruleForm, end_date: e.target.value })} required /></label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={input} type="number" placeholder={L('Price ₹', 'कीमत ₹')} value={ruleForm.price} onChange={(e) => setRuleForm({ ...ruleForm, price: e.target.value })} required />
                    <input className={input} placeholder={L('Label (Diwali, weekend)', 'नाम (दिवाली, वीकेंड)')} value={ruleForm.label} onChange={(e) => setRuleForm({ ...ruleForm, label: e.target.value })} />
                  </div>
                  <button className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Add price rule', 'कीमत नियम जोड़ें')}</button>
                </form>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {rules.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span>{r.start_date} → {r.end_date} <span className="block text-xs text-slate-500">{types.find((t) => t.id === r.room_type_id)?.name_en} {r.label ? `· ${r.label}` : ''}</span></span>
                      <span className="flex items-center gap-2">
                        <b className="text-amber-700">{inr(r.price)}</b>
                        <button onClick={async () => { await apiClient.entities.PricingRule.delete(r.id); refresh(); }} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
                      </span>
                    </li>
                  ))}
                  {rules.length === 0 && <li className="py-2 text-slate-500">{L('No price rules.', 'कोई कीमत नियम नहीं।')}</li>}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {typeForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <form onSubmit={saveType} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{typeForm.id ? L('Edit room type', 'प्रकार संपादित करें') : L('New room type', 'नया कमरा प्रकार')}</h2>
              <button type="button" onClick={() => setTypeForm(null)}><X size={20} /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">{L('Name (English)', 'नाम (अंग्रेज़ी)')}<input className={input} value={typeForm.name_en} onChange={(e) => setTypeForm({ ...typeForm, name_en: e.target.value })} required /></label>
              <label className="text-sm">{L('Name (Hindi)', 'नाम (हिन्दी)')}<input className={input} value={typeForm.name_hi} onChange={(e) => setTypeForm({ ...typeForm, name_hi: e.target.value })} /></label>
              <label className="text-sm">{L('Price per night ₹', 'प्रति रात ₹')}<input className={input} type="number" value={typeForm.price} onChange={(e) => setTypeForm({ ...typeForm, price: e.target.value })} required /></label>
              <label className="text-sm">{L('Rooms of this type', 'इस प्रकार के कमरे')}<input className={input} type="number" min="1" value={typeForm.total_rooms} onChange={(e) => setTypeForm({ ...typeForm, total_rooms: e.target.value })} /></label>
              <label className="text-sm">{L('Capacity', 'क्षमता')}<input className={input} type="number" min="1" value={typeForm.capacity} onChange={(e) => setTypeForm({ ...typeForm, capacity: e.target.value })} /></label>
              <label className="text-sm">{L('Photo URLs (comma separated)', 'फ़ोटो URL (कॉमा से)')}<input className={input} value={typeForm.images} onChange={(e) => setTypeForm({ ...typeForm, images: e.target.value })} /></label>
              <label className="text-sm sm:col-span-2">{L('Description', 'विवरण')}<textarea rows={2} className={input} value={typeForm.desc_en} onChange={(e) => setTypeForm({ ...typeForm, desc_en: e.target.value })} /></label>
              <label className="text-sm sm:col-span-2">{L('Amenities (comma separated)', 'सुविधाएँ (कॉमा से)')}<input className={input} value={typeForm.amenities} onChange={(e) => setTypeForm({ ...typeForm, amenities: e.target.value })} placeholder="ac, wifi, tv" /></label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setTypeForm(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
              <button className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Save', 'सेव')}</button>
            </div>
          </form>
        </div>
      )}

      {roomForm.open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <form onSubmit={addRoom} className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{L('Add room number', 'कमरा नंबर जोड़ें')}</h2><button type="button" onClick={() => setRoomForm({ ...roomForm, open: false })}><X size={20} /></button></div>
            <label className="text-sm">{L('Number', 'नंबर')}<input className={input} value={roomForm.number} onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })} required /></label>
            <label className="mt-2 block text-sm">{L('Room type', 'कमरे का प्रकार')}
              <select className={input} value={roomForm.room_type_id} onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })} required>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-sm">{L('Floor', 'मंज़िल')}<input className={input} value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} /></label>
            <button className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Save', 'सेव')}</button>
          </form>
        </div>
      )}
    </div>
  );
}
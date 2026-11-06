import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { Plus, Trash2, Pencil, X, Upload, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { ROOM_STATUS, audit, inr, money, todayISO } from '../lib/adminData';
import AvailabilityCalendar from './AvailabilityCalendar';
import Empty from '../components/Empty';
import {
  setRoomsData,
  updateRoomTypeOptimistic,
  addRoomTypeOptimistic,
  deleteRoomTypeOptimistic,
  addRoomOptimistic,
  updateRoomOptimistic,
  deleteRoomOptimistic,
  addBlockedDateOptimistic,
  deleteBlockedDateOptimistic,
  addPricingRuleOptimistic,
  deletePricingRuleOptimistic,
} from '@/store/slices/roomsSlice';

const blankType = { name_en: '', name_hi: '', desc_en: '', price: '', capacity: 2, total_rooms: 1, amenities: '', images: '' };

export default function RoomsAdmin() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'types');
  const [typeForm, setTypeForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [roomForm, setRoomForm] = useState({ open: false, number: '', room_type_id: '', floor: '' });
  const [blockForm, setBlockForm] = useState({ room_type_id: '', start_date: todayISO(), end_date: '', reason: '' });
  const [ruleForm, setRuleForm] = useState({ room_type_id: '', start_date: '', end_date: '', price: '', label: '' });
  const qc = useQueryClient();

  const reduxTypes = useSelector((state) => state.rooms.types);
  const reduxRooms = useSelector((state) => state.rooms.rooms);
  const reduxBlocks = useSelector((state) => state.rooms.blocks);
  const reduxRules = useSelector((state) => state.rooms.rules);
  const isRoomsLoaded = useSelector((state) => state.rooms.isLoaded);

  const handleRoomImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiClient.upload(file, 'room-photos');
      setTypeForm((prev) => ({
        ...prev,
        images: prev?.images ? `${prev.images}, ${res.url}` : res.url,
      }));
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

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
      const res = { types: types.items, rooms: rooms.items, bookings: bookings.items, blocks: blocks.items, rules: rules.items };
      dispatch(setRoomsData(res));
      return res;
    },
  });

  useEffect(() => {
    if (data) {
      dispatch(setRoomsData(data));
    }
  }, [data, dispatch]);

  const types = isRoomsLoaded ? reduxTypes : (data?.types || []);
  const rooms = isRoomsLoaded ? reduxRooms : (data?.rooms || []);
  const bookings = data?.bookings || [];
  const blocks = isRoomsLoaded ? reduxBlocks : (data?.blocks || []);
  const rules = isRoomsLoaded ? reduxRules : (data?.rules || []);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-rooms'] }); qc.invalidateQueries({ queryKey: ['public-rooms'] }); };

  const saveType = async (e) => {
    e.preventDefault();
    const totalCount = Number(typeForm.total_rooms) || 1;
    const payload = {
      ...typeForm,
      price: money(typeForm.price),
      capacity: Number(typeForm.capacity) || 2,
      total_rooms: totalCount,
      total_inventory: totalCount,
      amenities: String(typeForm.amenities || '').split(',').map((s) => s.trim()).filter(Boolean),
      images: String(typeForm.images || '').split(',').map((s) => s.trim()).filter(Boolean),
    };

    // Instant optimistic update
    if (payload.id) {
      dispatch(updateRoomTypeOptimistic(payload));
    } else {
      dispatch(addRoomTypeOptimistic({ ...payload, id: `temp-${Date.now()}` }));
    }
    setTypeForm(null);

    try {
      if (payload.id) await apiClient.entities.RoomType.update(payload.id, payload);
      else await apiClient.entities.RoomType.create(payload);
      audit(me, 'save', 'rooms', 'RoomType', payload.id || '', `${payload.name_en} ₹${payload.price}`).catch(() => {});
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to save room type');
      refresh();
    }
  };

  const addRoom = async (e) => {
    e.preventDefault();
    const typeId = roomForm.room_type_id || types[0]?.id;
    if (!typeId) {
      alert(L('Please select a room category.', 'कृपया एक कमरा प्रकार चुनें।'));
      return;
    }

    const targetType = types.find((t) => t.id === typeId);
    const currentCount = rooms.filter((r) => r.room_type_id === typeId).length;
    const maxAllowed = Number(targetType?.total_rooms ?? targetType?.total_inventory ?? 1);

    if (currentCount >= maxAllowed) {
      alert(
        L(
          `Cannot add room number. Category "${targetType?.name_en || ''}" is limited to ${maxAllowed} room(s) max (${currentCount} already created). Please increase room count in Room Types tab first.`,
          `कमरा नंबर नहीं जोड़ सकते। श्रेणी "${targetType?.name_en || ''}" में अधिकतम ${maxAllowed} कमरे तय हैं (${currentCount} पहले से बने हैं)। कृपया पहले रूम टाइप्स टैब में कमरों की संख्या बढ़ाएं।`
        )
      );
      return;
    }

    const roomNumClean = String(roomForm.number || '').trim();
    if (!roomNumClean) {
      alert(L('Please enter a valid room number.', 'कृपया मान्य कमरा नंबर दर्ज करें।'));
      return;
    }

    const duplicate = rooms.find((r) => String(r.number || r.room_number).trim().toLowerCase() === roomNumClean.toLowerCase());
    if (duplicate) {
      alert(L(`Room number ${roomNumClean} already exists! Please choose another room number.`, `कमरा नंबर ${roomNumClean} पहले से मौजूद है! कृपया कोई दूसरा नंबर चुनें।`));
      return;
    }

    // Instant optimistic addition
    const tempRoom = {
      id: `temp-${Date.now()}`,
      number: roomNumClean,
      room_number: roomNumClean,
      room_type_id: typeId,
      floor: Number(roomForm.floor) || 1,
      status: 'available',
      is_active: true,
    };
    dispatch(addRoomOptimistic(tempRoom));
    setRoomForm({ open: false, number: '', room_type_id: '', floor: '' });

    try {
      await apiClient.entities.Room.create({
        number: roomNumClean,
        room_type_id: typeId,
        floor: Number(roomForm.floor) || 1,
        status: 'available',
        is_active: true,
      });
      audit(me, 'create', 'rooms', 'Room', '', `Added Room ${roomNumClean}`).catch(() => {});
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to add room number');
      refresh();
    }
  };

  const deleteRoom = async (room) => {
    if (!window.confirm(L(`Are you sure you want to delete Room ${room.number || room.room_number}?`, `क्या आप कमरा ${room.number || room.room_number} मिटाना चाहते हैं?`))) {
      return;
    }
    // Instant optimistic deletion
    dispatch(deleteRoomOptimistic(room.id));
    try {
      await apiClient.entities.Room.delete(room.id);
      audit(me, 'delete', 'rooms', 'Room', room.id, `Deleted Room ${room.number || room.room_number}`).catch(() => {});
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to delete room');
      refresh();
    }
  };

  const setRoomStatus = async (room, status) => {
    // Instant optimistic update
    dispatch(updateRoomOptimistic({ id: room.id, status }));
    try {
      await apiClient.entities.Room.update(room.id, { status });
      audit(me, 'status', 'rooms', 'Room', room.id, `Room ${room.number || room.room_number} → ${status}`).catch(() => {});
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to update room status');
      refresh();
    }
  };

  const addBlock = async (e) => {
    e.preventDefault();
    if (!blockForm.room_type_id || !blockForm.start_date || !blockForm.end_date) return;
    const tempBlock = { ...blockForm, id: `temp-${Date.now()}` };
    dispatch(addBlockedDateOptimistic(tempBlock));
    setBlockForm({ ...blockForm, end_date: '', reason: '' });
    try {
      await apiClient.entities.BlockedDate.create(blockForm);
      audit(me, 'block', 'rooms', 'BlockedDate', '', `${blockForm.start_date} → ${blockForm.end_date}`).catch(() => {});
      refresh();
    } catch (err) {
      refresh();
    }
  };

  const addRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.room_type_id || !ruleForm.start_date || !ruleForm.end_date || !ruleForm.price) return;
    const tempRule = { ...ruleForm, price: money(ruleForm.price), id: `temp-${Date.now()}` };
    dispatch(addPricingRuleOptimistic(tempRule));
    setRuleForm({ room_type_id: '', start_date: '', end_date: '', price: '', label: '' });
    try {
      await apiClient.entities.PricingRule.create({ ...ruleForm, price: money(ruleForm.price) });
      audit(me, 'price', 'rooms', 'PricingRule', '', `${ruleForm.start_date} → ${ruleForm.end_date} ₹${ruleForm.price}`).catch(() => {});
      refresh();
    } catch (err) {
      refresh();
    }
  };

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';
  const tabs = [['types', L('Room types', 'कमरे के प्रकार')], ['rooms', L('Room numbers', 'कमरे')], ['calendar', L('Availability', 'उपलब्धता')], 
  // ['blocks', L('Blocks & pricing', 'ब्लॉक और कीमत')]
];

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
                          <p className="text-xs text-slate-500">{t.name_hi} · {t.capacity} {L('guests', 'मेहमान')} · {t.total_rooms ?? t.total_inventory ?? 1} {L('rooms', 'कमरे')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-amber-700">{inr(t.price)}</p>
                          <p className="text-[11px] text-slate-400">/{L('night', 'रात')}</p>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.desc_en}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setTypeForm({ ...t, total_rooms: t.total_rooms ?? t.total_inventory ?? 1, amenities: (t.amenities || []).join(', '), images: (t.images || []).join(', ') })} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"><Pencil size={12} />{L('Edit', 'संपादित')}</button>
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
                        <p className="text-xs text-slate-500">{types.find((t) => t.id === r.room_type_id)?.name_en || '—'}{r.floor ? ` · Floor ${r.floor}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select value={r.status} onChange={(e) => setRoomStatus(r, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold">
                          {Object.entries(ROOM_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
                        </select>
                        {['owner', 'admin'].includes(me?.staff_role || me?.role) && (
                          <button
                            type="button"
                            onClick={() => deleteRoom(r)}
                            className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                            title={L('Delete room number', 'कमरा नंबर हटाएं')}
                            aria-label="Delete room"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
                      <button onClick={async () => { dispatch(deleteBlockedDateOptimistic(b.id)); try { await apiClient.entities.BlockedDate.delete(b.id); refresh(); } catch { refresh(); } }} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
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
                        <button onClick={async () => { dispatch(deletePricingRuleOptimistic(r.id)); try { await apiClient.entities.PricingRule.delete(r.id); refresh(); } catch { refresh(); } }} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
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
              <label className="text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span>{L('Photo URLs (comma separated)', 'फ़ोटो URL (कॉमा से)')}</span>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    <span>{uploading ? L('Uploading…', 'अपलोड…') : L('Upload', 'अपलोड')}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleRoomImageUpload} disabled={uploading} />
                  </label>
                </div>
                <input className={input} value={typeForm.images} onChange={(e) => setTypeForm({ ...typeForm, images: e.target.value })} placeholder="https://…" />
              </label>
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

      {roomForm.open && (() => {
        const selectedTypeId = roomForm.room_type_id || types[0]?.id;
        const selectedType = types.find((t) => t.id === selectedTypeId);
        const currentCount = rooms.filter((r) => r.room_type_id === selectedTypeId).length;
        const maxAllowed = Number(selectedType?.total_rooms ?? selectedType?.total_inventory ?? 1);
        const isFull = currentCount >= maxAllowed;

        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
            <form onSubmit={addRoom} className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{L('Add room number', 'कमरा नंबर जोड़ें')}</h2>
                <button type="button" onClick={() => setRoomForm({ ...roomForm, open: false })}><X size={20} /></button>
              </div>
              <label className="text-sm">{L('Room number', 'कमरा नंबर')}<input className={input} placeholder="e.g. 101" value={roomForm.number} onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })} required /></label>
              <label className="mt-2 block text-sm">{L('Room category', 'कमरे का प्रकार')}
                <select className={input} value={selectedTypeId} onChange={(e) => setRoomForm({ ...roomForm, room_type_id: e.target.value })} required>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name_en} ({t.total_rooms ?? t.total_inventory ?? 1} total)</option>)}
                </select>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                {L('Category capacity:', 'श्रेणी क्षमता:')}{' '}
                <span className={`font-semibold ${isFull ? 'text-red-600' : 'text-slate-800'}`}>
                  {currentCount} / {maxAllowed} {L('rooms created', 'कमरे बने')}
                </span>
              </p>
              {isFull && (
                <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">
                  {L('Category capacity reached. Increase room count in Room Types tab to add more room numbers.', 'इस श्रेणी की क्षमता पूरी हो चुकी है। और कमरे जोड़ने के लिए पहले रूम टाइप्स टैब में संख्या बढ़ाएं।')}
                </p>
              )}
              <label className="mt-2 block text-sm">{L('Floor', 'मंज़िल')}<input className={input} placeholder="e.g. 1 or 2" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} /></label>
              <button disabled={isFull} className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{L('Save room number', 'कमरा नंबर सेव करें')}</button>
            </form>
          </div>
        );
      })()}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';

const blank = { name_en: '', name_hi: '', desc: '', price: '', category_id: '', image_url: '', is_veg: true, tags: '', is_available: true, sort: 0 };

export default function MenuItemForm({ open, item, categories, onClose, onSaved }) {
  const { L } = useI18n();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(item ? { ...blank, ...item, tags: (item.tags || []).join(', ') } : { ...blank, category_id: categories[0]?.id || '' });
  }, [open, item, categories]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const res = await apiClient.upload(file, 'menu-photos');
      setF((prev) => ({ ...prev, image_url: res.url }));
    } catch (ex) {
      setErr(ex.message || L('Upload failed.', 'अपलोड विफल रहा।'));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (f.name_en.trim().length < 2) return setErr(L('Enter the dish name.', 'डिश का नाम डालें।'));
    if (!(Number(f.price) > 0)) return setErr(L('Enter a price.', 'कीमत डालें।'));
    if (!f.category_id) return setErr(L('Choose a category.', 'श्रेणी चुनें।'));
    setBusy(true);
    try {
      const payload = {
        ...f,
        price: Number(f.price),
        sort: Number(f.sort) || 0,
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (item) await apiClient.entities.MenuItem.update(item.id, payload);
      else await apiClient.entities.MenuItem.create(payload);
      onSaved?.();
      onClose();
    } catch (ex) {
      setErr(ex.message || L('Could not save.', 'सेव नहीं हुआ।'));
    } finally { setBusy(false); }
  };

  if (!open) return null;
  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{item ? L('Edit dish', 'डिश संपादित करें') : L('New dish', 'नई डिश')}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">{L('Name (English)', 'नाम (अंग्रेज़ी)')}<input className={input} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Name (Hindi)', 'नाम (हिन्दी)')}<input className={input} value={f.name_hi} onChange={(e) => setF({ ...f, name_hi: e.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">{L('Price ₹', 'कीमत ₹')}<input className={input} type="number" min="1" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></label>
          <label className="text-sm font-medium text-slate-700">{L('Category', 'श्रेणी')}
            <select className={input} value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">{L('Description', 'विवरण')}<textarea rows={2} className={input} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <span>{L('Photo URL', 'फ़ोटो URL')}</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                <span>{uploading ? L('Uploading…', 'अपलोड हो रहा है…') : L('Upload to Storage', 'स्टोरेज में अपलोड करें')}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
            <input className={input} value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://…" />
          </label>
          <label className="text-sm font-medium text-slate-700">{L('Tags', 'टैग')}<input className={input} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="bestseller, spicy, new" /></label>
          <label className="text-sm font-medium text-slate-700">{L('Sort', 'क्रम')}<input className={input} type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_available} onChange={(e) => setF({ ...f, is_available: e.target.checked })} className="h-5 w-5" />{L('Available on the website', 'वेबसाइट पर उपलब्ध')}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_veg} onChange={(e) => setF({ ...f, is_veg: e.target.checked })} className="h-5 w-5" />{L('Vegetarian', 'शाकाहारी')}</label>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
          <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <><Loader2 className="animate-spin" size={16} />{L('Saving…', 'सेव…')}</> : L('Save dish', 'डिश सेव करें')}
          </button>
        </div>
      </form>
    </div>
  );
}
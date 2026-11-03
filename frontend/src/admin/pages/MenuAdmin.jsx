import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, Trash2, Pencil, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { MENU } from '@/data/menu';
import { audit, downloadCsv, inr, money } from '../lib/adminData';
import MenuItemForm from '../components/MenuItemForm';
import Confirm from '../components/Confirm';
import Empty from '../components/Empty';

export default function MenuAdmin() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [form, setForm] = useState({ open: params.get('new') === '1', item: null });
  const [del, setDel] = useState(null);
  const [bulk, setBulk] = useState({ open: false, mode: 'percent', value: '', category_id: '' });
  const [seeding, setSeeding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const qc = useQueryClient();

  useEffect(() => { setForm({ open: params.get('new') === '1', item: null }); }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: async () => {
      const [categories, items] = await Promise.all([
        base44.entities.MenuCategory.list(),
        base44.entities.MenuItem.filter({}, { sort: 'sort', limit: 500 }),
      ]);
      return { categories: Array.isArray(categories) ? categories : [], items: items.items || [] };
    },
  });

  const categories = data?.categories || [];
  const items = data?.items || [];
  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name_en])), [categories]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => (!cat || i.category_id === cat) && (!term || i.name_en.toLowerCase().includes(term) || (i.name_hi || '').includes(term)));
  }, [items, q, cat]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-menu'] }); qc.invalidateQueries({ queryKey: ['public-menu'] }); };

  const toggleStock = async (item) => {
    await base44.entities.MenuItem.update(item.id, { is_available: !item.is_available });
    await audit(me, 'update', 'menu', 'MenuItem', item.id, `${item.name_en} → ${!item.is_available ? 'out of stock' : 'available'}`);
    refresh();
  };

  const addCategory = async () => {
    if (newCat.trim().length < 2) return;
    await base44.entities.MenuCategory.create({ name_en: newCat.trim(), name_hi: '', sort: categories.length });
    setNewCat('');
    refresh();
  };

  const removeItem = async () => {
    await base44.entities.MenuItem.delete(del.id);
    await audit(me, 'delete', 'menu', 'MenuItem', del.id, `Deleted dish ${del.name_en}`);
    setDel(null);
    refresh();
  };

  const runBulk = async () => {
    const list = items.filter((i) => !bulk.category_id || i.category_id === bulk.category_id);
    const value = Number(bulk.value);
    if (!value) return;
    const updates = list.map((i) => ({
      id: i.id,
      price: bulk.mode === 'percent' ? Math.max(1, Math.round(money(i.price) * (1 + value / 100))) : Math.max(1, Math.round(money(i.price) + value)),
    }));
    await base44.entities.MenuItem.bulkUpdate(updates);
    await audit(me, 'price', 'menu', 'MenuItem', '', `Bulk price ${bulk.mode} ${value} on ${updates.length} dishes`);
    setBulk({ ...bulk, open: false, value: '' });
    refresh();
  };

  /** Load the printed menu (src/data/menu.js) into the database once. */
  const seed = async () => {
    setSeeding(true);
    try {
      const created = [];
      for (let c = 0; c < MENU.length; c += 1) {
        const category = await base44.entities.MenuCategory.create({
          name_en: MENU[c].name.en, name_hi: MENU[c].name.hi, sort: c, is_active: true,
        });
        created.push({ ...MENU[c], dbId: category.id });
      }
      const allItems = created.flatMap((c) => c.items.map((i) => ({
        category_id: c.dbId, name_en: i.name, name_hi: '', desc: i.desc, price: i.price,
        is_veg: true, is_available: true, tags: [], sort: c.items.indexOf(i),
      })));
      for (let i = 0; i < allItems.length; i += 40) {
        await base44.entities.MenuItem.bulkCreate(allItems.slice(i, i + 40));
      }
      await audit(me, 'import', 'menu', 'MenuItem', '', `Seeded ${created.length} categories, ${allItems.length} dishes`);
      refresh();
    } finally { setSeeding(false); }
  };

  const exportCsv = () => downloadCsv('menu.csv', rows, [
    { label: 'Category', value: (i) => catName[i.category_id] || '' },
    { label: 'Name', value: (i) => i.name_en },
    { label: 'Hindi', value: (i) => i.name_hi },
    { label: 'Price', value: (i) => i.price },
    { label: 'Available', value: (i) => (i.is_available ? 'yes' : 'no') },
    { label: 'Tags', value: (i) => (i.tags || []).join('|') },
  ]);

  const input = 'rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{L('Menu', 'मेन्यू')}</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><Download size={16} />CSV</button>
          <button onClick={() => setBulk({ ...bulk, open: true })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">{L('Bulk price', 'थोक कीमत')}</button>
          <button onClick={() => setForm({ open: true, item: null })} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('Add dish', 'डिश जोड़ें')}</button>
        </div>
      </div>

      {items.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">{L('Your database menu is empty. Load the printed menu to start editing.', 'डेटाबेस मेन्यू खाली है। मुद्रित मेन्यू लोड करके संपादन शुरू करें।')}</p>
          <button onClick={seed} disabled={seeding} className="mt-3 flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Upload size={16} />{seeding ? L('Importing…', 'आयात हो रहा है…') : L('Import built-in menu', 'अंतर्निहित मेन्यू आयात करें')}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search dishes', 'डिश खोजें')} className={`${input} w-full pl-9`} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={input}>
            <option value="">{L('All categories', 'सभी श्रेणियाँ')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={L('New category', 'नई श्रेणी')} className={input} />
            <button onClick={addCategory} className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
      ) : rows.length === 0 ? (
        <Empty title={L('No dishes found', 'कोई डिश नहीं मिली')} hint={L('Add a dish or import the printed menu.', 'डिश जोड़ें या मुद्रित मेन्यू आयात करें।')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">{L('Dish', 'डिश')}</th><th className="px-4 py-3">{L('Category', 'श्रेणी')}</th><th className="px-4 py-3 text-right">{L('Price', 'कीमत')}</th><th className="px-4 py-3">{L('In stock', 'स्टॉक')}</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((i) => (
                <tr key={i.id} className={i.is_available ? '' : 'bg-slate-50/70'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{i.name_en}</p>
                    <p className="text-xs text-slate-500">{i.name_hi || '—'}{(i.tags || []).length ? ` · ${i.tags.join(', ')}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{catName[i.category_id] || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{inr(i.price)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStock(i)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${i.is_available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      {i.is_available ? L('Available', 'उपलब्ध') : L('Out of stock', 'स्टॉक में नहीं')}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setForm({ open: true, item: i })} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Edit"><Pencil size={14} /></button>
                      {me?.staff_role !== 'staff' && <button onClick={() => setDel(i)} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MenuItemForm open={form.open} item={form.item} categories={categories} onClose={() => { setForm({ open: false, item: null }); setParams({}); }} onSaved={refresh} />
      <Confirm open={!!del} title={L('Delete this dish?', 'यह डिश मिटाएँ?')} message={del?.name_en} onConfirm={removeItem} onCancel={() => setDel(null)} />

      {bulk.open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="mb-3 font-semibold text-slate-900">{L('Bulk price update', 'थोक कीमत अपडेट')}</h2>
            <select value={bulk.category_id} onChange={(e) => setBulk({ ...bulk, category_id: e.target.value })} className={`${input} w-full`}>
              <option value="">{L('All categories', 'सभी श्रेणियाँ')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <select value={bulk.mode} onChange={(e) => setBulk({ ...bulk, mode: e.target.value })} className={`${input} flex-1`}>
                <option value="percent">{L('Percent %', 'प्रतिशत %')}</option>
                <option value="fixed">{L('Fixed ₹', 'रुपये ₹')}</option>
              </select>
              <input type="number" value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} placeholder="+10 / -20" className={`${input} flex-1`} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{L('Use a negative number to reduce prices.', 'कीमत घटाने के लिए ऋणात्मक संख्या लिखें।')}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setBulk({ ...bulk, open: false })} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
              <button onClick={runBulk} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Apply', 'लागू करें')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
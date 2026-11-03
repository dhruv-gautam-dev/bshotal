import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, MessageCircle, X, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { ENQUIRY_STATUS, audit, inr } from '../lib/adminData';
import StatusPill from '../components/StatusPill';
import Empty from '../components/Empty';

const TYPES = { ring: 'Ring ceremony', birthday: 'Birthday', wedding: 'Wedding', custom: 'Custom', contact: 'Contact message' };
const blankPkg = { title_en: '', title_hi: '', desc_en: '', capacity: '', price_from: '', price_to: '', inclusions: '', image_url: '' };

export default function Enquiries() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [tab, setTab] = useState('inbox');
  const [filter, setFilter] = useState('');
  const [type, setType] = useState('');
  const [active, setActive] = useState(null);
  const [pkg, setPkg] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-enquiries'],
    queryFn: async () => {
      const [enquiries, packages] = await Promise.all([
        base44.entities.Enquiry.filter({}, { sort: '-created_date', limit: 200 }),
        base44.entities.EventPackage.filter({}, { sort: 'sort', limit: 50 }),
      ]);
      return { enquiries: enquiries.items, packages: packages.items };
    },
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-enquiries'] }); qc.invalidateQueries({ queryKey: ['public-packages'] }); };

  const rows = useMemo(() => (data?.enquiries || []).filter((e) => (!filter || e.status === filter) && (!type || e.type === type)), [data, filter, type]);

  const update = async (patch, log) => {
    await base44.entities.Enquiry.update(active.id, patch);
    await audit(me, 'update', 'enquiries', 'Enquiry', active.id, log);
    setActive({ ...active, ...patch });
    refresh();
  };

  const savePkg = async (e) => {
    e.preventDefault();
    const payload = { ...pkg, price_from: Number(pkg.price_from) || 0, price_to: Number(pkg.price_to) || 0, inclusions: String(pkg.inclusions || '').split(',').map((s) => s.trim()).filter(Boolean) };
    if (payload.id) await base44.entities.EventPackage.update(payload.id, payload);
    else await base44.entities.EventPackage.create(payload);
    setPkg(null);
    refresh();
  };

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{L('Events & enquiries', 'कार्यक्रम और पूछताछ')}</h1>
        {tab === 'packages' && <button onClick={() => setPkg({ ...blankPkg })} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />{L('Add package', 'पैकेज जोड़ें')}</button>}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[['inbox', L('Inbox', 'इनबॉक्स')], ['packages', L('Event packages', 'इवेंट पैकेज')]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'inbox' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">{L('All statuses', 'सभी स्थिति')}</option>
              {Object.entries(ENQUIRY_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">{L('All types', 'सभी प्रकार')}</option>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="self-center text-xs text-slate-500">{rows.length} {L('messages', 'संदेश')}</span>
          </div>

          {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" /> : rows.length === 0 ? (
            <Empty title={L('Inbox is empty', 'इनबॉक्स खाली है')} hint={L('Event enquiries and contact messages land here.', 'कार्यक्रम पूछताछ और संपर्क संदेश यहाँ आएँगे।')} />
          ) : (
            <div className="space-y-2">
              {rows.map((e) => (
                <button key={e.id} onClick={() => setActive(e)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{e.name} <span className="text-xs font-normal text-slate-500">· {TYPES[e.type] || e.type}</span></p>
                      <p className="text-xs text-slate-500">{e.phone}{e.event_date ? ` · ${e.event_date}` : ''}{e.guests ? ` · ${e.guests} ${L('guests', 'मेहमान')}` : ''}</p>
                    </div>
                    <StatusPill kind="enquiry" value={e.status} />
                  </div>
                  {e.message && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{e.message}</p>}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.packages || []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.title_en}</p>
                  <p className="text-xs text-slate-500">{p.capacity} · {inr(p.price_from)}–{inr(p.price_to)}</p>
                </div>
                <button onClick={async () => { await base44.entities.EventPackage.delete(p.id); refresh(); }} className="rounded-lg border border-slate-200 p-2 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.desc_en}</p>
              <button onClick={() => setPkg({ ...p, inclusions: (p.inclusions || []).join(', ') })} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">{L('Edit', 'संपादित')}</button>
            </div>
          ))}
          {(data?.packages || []).length === 0 && <Empty title={L('No event packages', 'कोई पैकेज नहीं')} hint={L('Packages show on the public Events page.', 'पैकेज सार्वजनिक इवेंट पेज पर दिखेंगे।')} />}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{active.name}</h2>
                <p className="text-xs text-slate-500">{TYPES[active.type] || active.type} · {active.ref}</p>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="mt-2 flex gap-2">
              <a href={`tel:+91${active.phone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold"><Phone size={15} />{L('Call', 'कॉल')}</a>
              <a href={`https://wa.me/91${active.phone}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"><MessageCircle size={15} />WhatsApp</a>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-slate-500">{L('Event date', 'तारीख')}</dt><dd>{active.event_date || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">{L('Guests', 'मेहमान')}</dt><dd>{active.guests || '—'}</dd></div>
            </dl>
            {active.message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{active.message}</p>}

            <label className="mt-4 block text-sm font-medium">{L('Status', 'स्थिति')}
              <select value={active.status} onChange={(e) => update({ status: e.target.value }, `Enquiry ${active.ref} → ${e.target.value}`)} className={input}>
                {Object.entries(ENQUIRY_STATUS).map(([k, v]) => <option key={k} value={k}>{L(v.en, v.hi)}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-sm font-medium">{L('Follow-up date', 'फ़ॉलो-अप तारीख')}
              <input type="date" value={active.follow_up_date || ''} onChange={(e) => update({ follow_up_date: e.target.value }, 'Follow-up set')} className={input} />
            </label>
            <label className="mt-2 block text-sm font-medium">{L('Notes', 'नोट्स')}
              <textarea rows={3} className={input} defaultValue={active.notes || ''} onBlur={(e) => e.target.value !== (active.notes || '') && update({ notes: e.target.value }, 'Notes updated')} />
            </label>
          </div>
        </div>
      )}

      {pkg && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <form onSubmit={savePkg} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{pkg.id ? L('Edit package', 'पैकेज संपादित') : L('New package', 'नया पैकेज')}</h2><button type="button" onClick={() => setPkg(null)}><X size={20} /></button></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">{L('Title', 'शीर्षक')}<input className={input} value={pkg.title_en} onChange={(e) => setPkg({ ...pkg, title_en: e.target.value })} required /></label>
              <label className="text-sm">{L('Hindi title', 'हिन्दी शीर्षक')}<input className={input} value={pkg.title_hi || ''} onChange={(e) => setPkg({ ...pkg, title_hi: e.target.value })} /></label>
              <label className="text-sm">{L('Capacity', 'क्षमता')}<input className={input} value={pkg.capacity || ''} onChange={(e) => setPkg({ ...pkg, capacity: e.target.value })} placeholder="80–150 guests" /></label>
              <label className="text-sm">{L('Photo URL', 'फ़ोटो URL')}<input className={input} value={pkg.image_url || ''} onChange={(e) => setPkg({ ...pkg, image_url: e.target.value })} /></label>
              <label className="text-sm">{L('Price from ₹', 'कीमत से ₹')}<input className={input} type="number" value={pkg.price_from || ''} onChange={(e) => setPkg({ ...pkg, price_from: e.target.value })} /></label>
              <label className="text-sm">{L('Price to ₹', 'कीमत तक ₹')}<input className={input} type="number" value={pkg.price_to || ''} onChange={(e) => setPkg({ ...pkg, price_to: e.target.value })} /></label>
              <label className="text-sm sm:col-span-2">{L('Description', 'विवरण')}<textarea rows={2} className={input} value={pkg.desc_en || ''} onChange={(e) => setPkg({ ...pkg, desc_en: e.target.value })} /></label>
              <label className="text-sm sm:col-span-2">{L('Inclusions (comma separated)', 'समावेश (कॉमा से)')}<input className={input} value={pkg.inclusions || ''} onChange={(e) => setPkg({ ...pkg, inclusions: e.target.value })} /></label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPkg(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
              <button className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Save', 'सेव')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
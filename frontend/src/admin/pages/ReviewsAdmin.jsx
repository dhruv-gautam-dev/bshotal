import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Check, EyeOff, Trash2, MessageSquare } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import { useI18n } from '@/lib/i18n';
import { useAdmin } from '../AdminContext';
import { audit } from '../lib/adminData';
import Empty from '../components/Empty';
import Confirm from '../components/Confirm';

export default function ReviewsAdmin() {
  const { L } = useI18n();
  const { me } = useAdmin();
  const [tab, setTab] = useState('pending');
  const [del, setDel] = useState(null);
  const [reply, setReply] = useState(null);
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => (await apiClient.entities.Review.filter({}, { sort: '-created_date', limit: 200 })).items,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-reviews'] }); qc.invalidateQueries({ queryKey: ['reviews-approved'] }); };

  const setStatus = async (r, status) => {
    await apiClient.entities.Review.update(r.id, { status });
    await audit(me, 'moderate', 'reviews', 'Review', r.id, `${r.name} → ${status}`);
    refresh();
  };

  const toggleFeatured = async (r) => {
    await apiClient.entities.Review.update(r.id, { is_featured: !r.is_featured });
    refresh();
  };

  const saveReply = async () => {
    await apiClient.entities.Review.update(reply.id, { admin_reply: text });
    await audit(me, 'reply', 'reviews', 'Review', reply.id, `Replied to ${reply.name}`);
    setReply(null);
    setText('');
    refresh();
  };

  const remove = async () => {
    await apiClient.entities.Review.delete(del.id);
    await audit(me, 'delete', 'reviews', 'Review', del.id, `Deleted review by ${del.name}`);
    setDel(null);
    refresh();
  };

  const rows = reviews.filter((r) => (tab === 'all' ? true : r.status === tab));
  const avg = reviews.length ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{L('Guest reviews', 'मेहमान समीक्षाएँ')}</h1>
        <span className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><Star size={16} />{avg} / 5 · {reviews.length}</span>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[['pending', L('Awaiting approval', 'स्वीकृति बाकी')], ['approved', L('Published', 'प्रकाशित')], ['rejected', L('Hidden', 'छिपी')], ['all', L('All', 'सभी')]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-2 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" /> : rows.length === 0 ? (
        <Empty title={L('Nothing here', 'यहाँ कुछ नहीं')} hint={L('Reviews submitted on the website appear here for approval.', 'वेबसाइट पर दी गई समीक्षाएँ यहाँ स्वीकृति के लिए आएँगी।')} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-amber-600">{'★'.repeat(Number(r.rating) || 0)}<span className="text-slate-300">{'★'.repeat(5 - (Number(r.rating) || 0))}</span></p>
                </div>
                <span className="text-[11px] text-slate-400">{new Date(r.created_date).toLocaleDateString('en-IN')}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{r.comment}</p>
              {r.admin_reply && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><b>{L('Your reply', 'आपका उत्तर')}:</b> {r.admin_reply}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.status !== 'approved' && <button onClick={() => setStatus(r, 'approved')} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Check size={13} />{L('Approve', 'स्वीकृत')}</button>}
                {r.status !== 'rejected' && <button onClick={() => setStatus(r, 'rejected')} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><EyeOff size={13} />{L('Hide', 'छिपाएँ')}</button>}
                <button onClick={() => { setReply(r); setText(r.admin_reply || ''); }} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><MessageSquare size={13} />{L('Reply', 'उत्तर')}</button>
                <button onClick={() => toggleFeatured(r)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${r.is_featured ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-700'}`}>{r.is_featured ? L('On home page', 'होम पेज पर') : L('Show on home', 'होम पर दिखाएँ')}</button>
                {me?.staff_role !== 'staff' && <button onClick={() => setDel(r)} className="ml-auto rounded-lg border border-slate-200 p-1.5 text-red-600" aria-label="Delete"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {reply && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="mb-2 font-semibold">{L('Reply to review', 'समीक्षा का उत्तर')}</h2>
            <p className="mb-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{reply.comment}</p>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder={L('Thank you for staying with us…', 'हमारे यहाँ ठहरने के लिए धन्यवाद…')} />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setReply(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold">{L('Cancel', 'रद्द')}</button>
              <button onClick={saveReply} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">{L('Save reply', 'उत्तर सेव')}</button>
            </div>
          </div>
        </div>
      )}

      <Confirm open={!!del} title={L('Delete this review?', 'यह समीक्षा मिटाएँ?')} message={del?.name} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
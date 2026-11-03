import { Inbox } from 'lucide-react';

export default function Empty({ title, hint, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Inbox className="mx-auto mb-3 text-slate-300" size={32} />
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}
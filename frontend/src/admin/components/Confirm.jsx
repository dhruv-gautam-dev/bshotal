import { AlertTriangle } from 'lucide-react';

/** Small destructive-action confirmation sheet (no Radix needed, works on mobile). */
export default function Confirm({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className={danger ? 'text-red-600' : 'text-amber-600'} size={22} />
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {message && <p className="mt-1 text-sm text-slate-600">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white ${danger ? 'bg-red-600' : 'bg-slate-900'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
export default function StatCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white text-slate-900 border-slate-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    red: 'bg-red-50 text-red-900 border-red-200',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {Icon && <Icon size={18} className="opacity-60" />}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs opacity-60">{hint}</p>}
    </div>
  );
}
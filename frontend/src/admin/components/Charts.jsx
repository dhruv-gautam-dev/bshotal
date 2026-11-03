import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { inr } from '../lib/adminData';

export function RevenueChart({ data }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={52} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
          <Tooltip formatter={(v, n) => (n === 'revenue' ? inr(v) : v)} labelStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" stroke="#b45309" strokeWidth={2.5} dot={false} name="revenue" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({ data }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} allowDecimals={false} />
          <Tooltip labelStyle={{ fontSize: 12 }} />
          <Bar dataKey="orders" fill="#0f172a" radius={[4, 4, 0, 0]} name="orders" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple ranked bars — no chart library needed. */
export function BarList({ rows = [], format = (v) => v }) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return <p className="py-6 text-center text-sm text-slate-500">No data yet.</p>;
  const max = Math.max(1, ...list.map((r) => Number(r?.value) || 0));
  return (
    <ul className="space-y-2.5">
      {list.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm">
            <span className="truncate pr-2 text-slate-700">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.round(((Number(r.value) || 0) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
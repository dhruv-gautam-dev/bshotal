import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { loginWithMfa } from '@/lib/authMfa';

/**
 * Staff & Admin sign-in for B.S. Hotel & Restaurant.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (loginEmail, loginPassword) => {
    setError('');
    setBusy(true);
    try {
      await loginWithMfa(loginEmail, loginPassword);
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message || 'Invalid email or password');
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-amber-400">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">B.S. Hotel · Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Owner and staff management sign-in</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          
          <label className="block text-sm font-medium text-slate-700">
            Email or Phone
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                autoComplete="username"
                required
                placeholder="Enter your email or phone"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {busy ? <><Loader2 className="animate-spin" size={16} /> Signing in…</> : 'Sign In as Admin'}
          </button>

          <div className="flex items-center justify-center text-xs pt-2">
            <Link to="/" className="text-slate-500 hover:underline">← Back to website</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

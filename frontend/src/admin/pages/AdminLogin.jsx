import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, Building2, LogIn } from 'lucide-react';
import { loginWithMfa } from '@/lib/authMfa';

/**
 * Staff & Management sign-in for B.S. Hotel & Restaurant.
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
      await loginWithMfa(loginEmail.trim(), loginPassword);
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message || 'Invalid email/phone or password');
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
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-amber-400 shadow-md">
            <Building2 size={26} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">B.S. Hotel & Restaurant</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to Hotel Management Portal</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700 animate-in fade-in" role="alert">
              {error}
            </p>
          )}
          
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Email or Mobile Number
            <div className="relative mt-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                autoComplete="username"
                required
                placeholder="Enter email or registered mobile number"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-normal"
              />
            </div>
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Password
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-normal"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all shadow-sm mt-2"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Signing in…
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign In to Hotel Portal
              </>
            )}
          </button>

          <div className="flex items-center justify-center text-xs pt-2">
            <Link to="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              ← Back to public website
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

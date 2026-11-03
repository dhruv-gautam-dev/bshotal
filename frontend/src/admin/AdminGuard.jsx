import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { AdminProvider, useAdmin } from './AdminContext';

function Gate() {
  const { me, status } = useAdmin();
  const navigate = useNavigate();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking access…
      </div>
    );
  }
  if (status === 'anon') return <Navigate to="/admin/login" replace />;
  if (status === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 text-amber-600" size={36} />
          <h1 className="text-lg font-semibold text-slate-900">No dashboard access</h1>
          <p className="mt-2 text-sm text-slate-600">
            {me?.email} is signed in but has not been added as staff. Ask the owner to give this account a role.
          </p>
          <button
            onClick={async () => { await base44.auth.logout(); navigate('/admin/login'); }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <LogOut size={16} /> Sign in with another account
          </button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

export default function AdminGuard() {
  return (
    <AdminProvider>
      <Gate />
    </AdminProvider>
  );
}
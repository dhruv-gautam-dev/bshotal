import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { can } from './lib/adminData';

const AdminContext = createContext(null);

/**
 * Loads the signed-in user once and works out what they may do.
 * role "admin" (or staff_role "owner") = owner: full access.
 * manager / staff come from the locked staff_role field on the user record.
 */
export function AdminProvider({ children }) {
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | anon | denied

  useEffect(() => {
    let alive = true;
    apiClient.auth.me()
      .then((user) => {
        if (!alive) return;
        if (!user) { setStatus('anon'); return; }
        const role = (user.role || '').toLowerCase();
        const staff_role = (role === 'admin' || role === 'owner')
          ? 'owner'
          : (role === 'manager' ? 'manager' : (role === 'staff' ? 'staff' : (user.staff_role || 'staff')));
        const allowed = user.is_active !== false && user.staff_active !== false && staff_role !== 'none';
        setMe({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, staff_role, allowed });
        setStatus(allowed ? 'ready' : 'denied');
      })
      .catch(() => { if (alive) setStatus('anon'); });
    return () => { alive = false; };
  }, []);

  return (
    <AdminContext.Provider value={{ me, status, can: (area) => can(me, area) }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
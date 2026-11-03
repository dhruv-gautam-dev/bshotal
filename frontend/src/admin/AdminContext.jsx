import React, { createContext, useContext, useState } from 'react'

export const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [adminUser, setAdminUser] = useState({ id: 'admin-1', role: 'admin', name: 'Hotel Manager' })
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <AdminContext.Provider value={{ adminUser, setAdminUser, sidebarOpen, setSidebarOpen }}>
      {children || <div>AdminContext</div>}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  return context || { adminUser: null, sidebarOpen: true, setSidebarOpen: () => {} }
}

export default AdminProvider


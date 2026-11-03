import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { AdminProvider } from './AdminContext'

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <Link to="/admin" className="font-bold text-lg text-navy-900">B.S. Hotel Admin</Link>
          <nav className="flex space-x-4 text-sm">
            <Link to="/admin" className="hover:text-primary">Overview</Link>
            <Link to="/admin/bookings" className="hover:text-primary">Bookings</Link>
            <Link to="/admin/rooms" className="hover:text-primary">Rooms</Link>
            <Link to="/admin/menu" className="hover:text-primary">Menu</Link>
            <Link to="/admin/orders" className="hover:text-primary">Orders</Link>
            <Link to="/" className="text-muted-foreground hover:underline">View Site</Link>
          </nav>
        </header>
        <main className="flex-1 p-6">
          {children || <Outlet />}
        </main>
      </div>
    </AdminProvider>
  )
}


import React from 'react'
import { Outlet } from 'react-router-dom'

export default function AdminGuard({ children }) {
  // Guard placeholder: allows access to admin dashboard routes
  return children ? <>{children}</> : <Outlet />
}


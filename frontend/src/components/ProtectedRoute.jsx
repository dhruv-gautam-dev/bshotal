import React from 'react'
import { Outlet } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  return children ? <>{children}</> : <Outlet />
}


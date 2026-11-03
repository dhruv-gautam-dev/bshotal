// Authentication context and provider for guest and staff sessions
import React, { createContext, useContext, useState } from 'react'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const login = async (credentials) => {
    setIsAuthenticated(true)
    setUser({ id: '1', role: 'admin', name: 'Admin User' })
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children || <div>AuthContext</div>}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    return { user: null, isAuthenticated: false, login: async () => {}, logout: () => {} }
  }
  return context
}

export default AuthProvider


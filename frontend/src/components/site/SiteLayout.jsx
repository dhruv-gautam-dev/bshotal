import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import FloatingWhatsApp from './FloatingWhatsApp'
import MobileBar from './MobileBar'

export default function SiteLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        {children || <Outlet />}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <MobileBar />
    </div>
  )
}


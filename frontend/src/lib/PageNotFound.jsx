import React from 'react'
import { Link } from 'react-router-dom'

export default function PageNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold text-navy-900 mb-2">404 - Page Not Found</h1>
      <p className="text-muted-foreground mb-6">The page you are looking for does not exist or has been moved.</p>
      <Link
        to="/"
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Back to Home
      </Link>
    </div>
  )
}


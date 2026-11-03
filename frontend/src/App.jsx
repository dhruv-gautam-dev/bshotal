import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import queryClient from '@/lib/query-client'
import { AuthProvider } from '@/lib/AuthContext'
import ScrollToTop from '@/components/ScrollToTop'

// Public Layout & Components
import SiteLayout from '@/components/site/SiteLayout'
import PageNotFound from '@/lib/PageNotFound'

// Public Pages
import Home from '@/pages/Home'
import Rooms from '@/pages/Rooms'
import Restaurant from '@/pages/Restaurant'
import Order from '@/pages/Order'
import Booking from '@/pages/Booking'
import Events from '@/pages/Events'
import Gallery from '@/pages/Gallery'
import Reviews from '@/pages/Reviews'
import Contact from '@/pages/Contact'
import Policy from '@/pages/Policy'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import OAuthConsent from '@/pages/OAuthConsent'

// Admin Layout, Guard & Pages
import AdminLayout from '@/admin/AdminLayout'
import AdminGuard from '@/admin/AdminGuard'
import Overview from '@/admin/pages/Overview'
import AdminLogin from '@/admin/pages/AdminLogin'
import AvailabilityCalendar from '@/admin/pages/AvailabilityCalendar'
import Bookings from '@/admin/pages/Bookings'
import BookingDetail from '@/admin/pages/BookingDetail'
import Customers from '@/admin/pages/Customers'
import Enquiries from '@/admin/pages/Enquiries'
import MenuAdmin from '@/admin/pages/MenuAdmin'
import Orders from '@/admin/pages/Orders'
import Reports from '@/admin/pages/Reports'
import ReviewsAdmin from '@/admin/pages/ReviewsAdmin'
import RoomsAdmin from '@/admin/pages/RoomsAdmin'
import SettingsAdmin from '@/admin/pages/SettingsAdmin'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public Pages wrapped in SiteLayout */}
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/restaurant" element={<Restaurant />} />
              <Route path="/order" element={<Order />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/events" element={<Events />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/oauth-consent" element={<OAuthConsent />} />
              <Route path="*" element={<PageNotFound />} />
            </Route>

            {/* Admin Login Route */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route index element={<Overview />} />
              <Route path="availability-calendar" element={<AvailabilityCalendar />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/:id" element={<BookingDetail />} />
              <Route path="customers" element={<Customers />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="menu" element={<MenuAdmin />} />
              <Route path="orders" element={<Orders />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reviews" element={<ReviewsAdmin />} />
              <Route path="rooms" element={<RoomsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
            </Route>
          </Routes>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}


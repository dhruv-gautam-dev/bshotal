import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { prefetchPublicData } from '@/lib/prefetch';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { I18nProvider } from '@/lib/i18n';
import { CartProvider } from '@/lib/cart';
import SiteLayout from '@/components/site/SiteLayout';
import Home from '@/pages/Home';
import Rooms from '@/pages/Rooms';
import Booking from '@/pages/Booking';
import Restaurant from '@/pages/Restaurant';
import Order from '@/pages/Order';
import Events from '@/pages/Events';
import Gallery from '@/pages/Gallery';
import Reviews from '@/pages/Reviews';
import Contact from '@/pages/Contact';
import Policy from '@/pages/Policy';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminGuard from '@/admin/AdminGuard';
import AdminLayout from '@/admin/AdminLayout';
import AdminLogin from '@/admin/pages/AdminLogin';
import AdminOverview from '@/admin/pages/Overview';
import AdminBookings from '@/admin/pages/Bookings';
import AdminBookingDetail from '@/admin/pages/BookingDetail';
import AdminOrders from '@/admin/pages/Orders';
import AdminRooms from '@/admin/pages/RoomsAdmin';
import AdminMenu from '@/admin/pages/MenuAdmin';
import AdminEnquiries from '@/admin/pages/Enquiries';
import AdminReviews from '@/admin/pages/ReviewsAdmin';
import AdminCustomers from '@/admin/pages/Customers';
import AdminReports from '@/admin/pages/Reports';
import AdminSettings from '@/admin/pages/SettingsAdmin';
import { useLiveSync } from '@/hooks/useLiveSync';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // Real-time Cross-Device SSE & Multi-Tab Synchronization
  useLiveSync();

  useEffect(() => {
    // Early background prefetching for public catalog data
    const timer = setTimeout(() => {
      prefetchPublicData(queryClient, dispatch);
    }, 100);
    return () => clearTimeout(timer);
  }, [queryClient, dispatch]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/restaurant" element={<Restaurant />} />
        <Route path="/order" element={<Order />} />
        <Route path="/events" element={<Events />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<Policy type="privacy" />} />
        <Route path="/terms" element={<Policy type="terms" />} />
        <Route path="/cancellation-refund" element={<Policy type="refund" />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="bookings/:id" element={<AdminBookingDetail />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="rooms" element={<AdminRooms />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <Provider store={store}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <I18nProvider>
            <CartProvider>
              <Router>
                <ScrollToTop />
                <AuthenticatedApp />
              </Router>
            </CartProvider>
          </I18nProvider>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </Provider>
  )
}

export default App
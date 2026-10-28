import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { DemoBar } from './components/DemoBar'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout, BrokerLayout } from './layouts/RoleLayouts'

const Landing = lazy(() => import('./pages/public/Landing'))
const Book = lazy(() => import('./pages/public/Book'))
const Confirmation = lazy(() => import('./pages/public/Confirmation'))
const ManageBooking = lazy(() => import('./pages/public/ManageBooking'))
const SitePlanPage = lazy(() => import('./pages/public/SitePlanPage'))
const NotFound = lazy(() => import('./pages/public/NotFound'))

const BrokerSignIn = lazy(() => import('./pages/auth/BrokerSignIn'))
const BrokerSignUp = lazy(() => import('./pages/auth/BrokerSignUp'))
const AdminSignIn = lazy(() => import('./pages/auth/AdminSignIn'))

const BrokerDashboard = lazy(() => import('./pages/broker/Dashboard'))
const BrokerBookings = lazy(() => import('./pages/broker/Bookings'))
const BrokerShare = lazy(() => import('./pages/broker/Share'))
const BrokerProfile = lazy(() => import('./pages/broker/Profile'))
const BrokerPlots = lazy(() => import('./pages/broker/PlotAvailability'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminBookings = lazy(() => import('./pages/admin/Bookings'))
const AdminCheckIn = lazy(() => import('./pages/admin/CheckIn'))
const AdminDisputes = lazy(() => import('./pages/admin/Disputes'))
const AdminActivity = lazy(() => import('./pages/admin/Activity'))
const AdminBrokers = lazy(() => import('./pages/admin/Brokers'))
const AdminSlots = lazy(() => import('./pages/admin/Slots'))
const AdminPlots = lazy(() => import('./pages/admin/Plots'))
const AdminPipeline = lazy(() => import('./pages/admin/Pipeline'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))

function PageLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" aria-busy="true" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-paddy-600" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="book" element={<Book />} />
            <Route path="booking/:ref" element={<Confirmation />} />
            <Route path="manage" element={<ManageBooking />} />
            <Route path="site-plan" element={<SitePlanPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="broker/sign-in" element={<BrokerSignIn />} />
          <Route path="broker/sign-up" element={<BrokerSignUp />} />
          <Route path="admin/sign-in" element={<AdminSignIn />} />

          <Route path="broker" element={<BrokerLayout />}>
            <Route index element={<BrokerDashboard />} />
            <Route path="bookings" element={<BrokerBookings />} />
            <Route path="share" element={<BrokerShare />} />
            <Route path="site-plan" element={<BrokerPlots />} />
            <Route path="profile" element={<BrokerProfile />} />
          </Route>

          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="check-in" element={<AdminCheckIn />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="brokers" element={<AdminBrokers />} />
            <Route path="slots" element={<AdminSlots />} />
            <Route path="plots" element={<AdminPlots />} />
            <Route path="pipeline" element={<AdminPipeline />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>
      <DemoBar />
      <Toaster position="top-center" toastOptions={{ className: 'font-sans', style: { borderRadius: 10, border: '1px solid var(--color-line)' } }} />
    </BrowserRouter>
  )
}

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import { AuthProvider, useAuth } from './store/auth'
import { AppProvider, PriceProvider } from './store/store'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Approvals = lazy(() => import('./pages/Approvals'))
const Market = lazy(() => import('./pages/Market'))
const Estimator = lazy(() => import('./pages/Estimator'))
const Calculators = lazy(() => import('./pages/Calculators'))
const HouseModel = lazy(() => import('./pages/HouseModel'))
const ProjectLayout = lazy(() => import('./pages/project/ProjectLayout'))
const Overview = lazy(() => import('./pages/project/Overview'))
const Schedule = lazy(() => import('./pages/project/Schedule'))
const Progress = lazy(() => import('./pages/project/Progress'))
const Budget = lazy(() => import('./pages/project/Budget'))
const Materials = lazy(() => import('./pages/project/Materials'))
const Plans = lazy(() => import('./pages/project/Plans'))
const Tour = lazy(() => import('./pages/project/Tour'))
const Changes = lazy(() => import('./pages/project/Changes'))
const Payments = lazy(() => import('./pages/project/Payments'))
const Ledger = lazy(() => import('./pages/project/Ledger'))

/** Sends signed-out visitors to the login page and back here afterwards. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export default function App() {
  return (
    <PriceProvider>
      <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-400">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth key="login" mode="login" />} />
            <Route path="/signup" element={<Auth key="signup" mode="signup" />} />
            <Route path="/:sector" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<ProjectLayout />}>
                <Route index element={<Overview />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="progress" element={<Progress />} />
                <Route path="budget" element={<Budget />} />
                <Route path="materials" element={<Materials />} />
                <Route path="plans" element={<Plans />} />
                <Route path="tour" element={<Tour />} />
                <Route path="changes" element={<Changes />} />
                <Route path="payments" element={<Payments />} />
                <Route path="ledger" element={<Ledger />} />
              </Route>
              <Route path="approvals" element={<Approvals />} />
              <Route path="market" element={<Market />} />
              <Route path="estimator" element={<Estimator />} />
              <Route path="calculators" element={<Calculators />} />
              <Route path="model" element={<HouseModel />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
      </AuthProvider>
    </PriceProvider>
  )
}

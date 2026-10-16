import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { Loading } from './components/ui'

// Each page is its own chunk, so the map and chart libraries load only where used.
const HomePage = lazy(() => import('./pages/HomePage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'))
const AssessPage = lazy(() => import('./pages/AssessPage'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'))
const MethodologyPage = lazy(() => import('./pages/MethodologyPage'))
const LocationPage = lazy(() => import('./pages/LocationPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const page = (Component) => (
  <Suspense fallback={<Loading />}>
    <Component />
  </Suspense>
)

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={page(HomePage)} />
        <Route path="dashboard" element={page(DashboardPage)} />
        <Route path="map" element={page(MapPage)} />
        <Route path="incidents" element={page(IncidentsPage)} />
        <Route path="assess" element={page(AssessPage)} />
        <Route path="alerts" element={page(AlertsPage)} />
        <Route path="report" element={page(ReportPage)} />
        <Route path="reports/:id" element={page(ReportDetailPage)} />
        <Route path="methodology" element={page(MethodologyPage)} />
        <Route path="locations/:id" element={page(LocationPage)} />
        <Route path="admin" element={page(AdminPage)} />
        <Route path="*" element={page(NotFoundPage)} />
      </Route>
    </Routes>
  )
}

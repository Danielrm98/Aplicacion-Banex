import type { ReactElement } from 'react'
import { Navigate, Route, HashRouter, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import InstallBanner from './components/InstallBanner'
import LoginPage from './pages/LoginPage'
import EntryPage from './pages/EntryPage'
import RecordsPage from './pages/RecordsPage'
import DashboardPage from './pages/DashboardPage'
import CatalogPage from './pages/CatalogPage'
import EspecificacionesPage from './pages/EspecificacionesPage'
import PlanPage from './pages/PlanPage'

function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-gray-500">Cargando...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : session ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<EntryPage />} />
        <Route path="/registros" element={<RecordsPage />} />
        <Route path="/reportes" element={<DashboardPage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
        <Route path="/especificaciones" element={<EspecificacionesPage />} />
        <Route path="/plan" element={<PlanPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <InstallBanner />
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

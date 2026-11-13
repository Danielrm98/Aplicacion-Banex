import type { ReactElement } from 'react'
import { Navigate, Route, HashRouter, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { usePerfil } from './lib/usePerfil'
import Layout from './components/Layout'
import InstallBanner from './components/InstallBanner'
import UpdatePrompt from './components/UpdatePrompt'
import LoginPage from './pages/LoginPage'
import EntryPage from './pages/EntryPage'
import RecordsPage from './pages/RecordsPage'
import DashboardPage from './pages/DashboardPage'
import CatalogPage from './pages/CatalogPage'
import EspecificacionesPage from './pages/EspecificacionesPage'
import PlanPage from './pages/PlanPage'
import PlanGeneralPage from './pages/PlanGeneralPage'
import VentaCanastillasPage from './pages/VentaCanastillasPage'
import EmbolsesPage from './pages/EmbolsesPage'
import RegistroEmbolsePage from './pages/RegistroEmbolsePage'
import RepiquesPage from './pages/RepiquesPage'
import RegistroRepiquePage from './pages/RegistroRepiquePage'
import RecobroPage from './pages/RecobroPage'
import RegistroLluviaPage from './pages/RegistroLluviaPage'
import EvaluacionBandaPage from './pages/EvaluacionBandaPage'
import PerfilRacimoPage from './pages/PerfilRacimoPage'
import RankingMarcasPage from './pages/RankingMarcasPage'

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

// Los menús de pura captura (Registrar, Registro de embolse, Registro de
// repique) no tienen sentido para el admin_lectura si no puede guardar
// nada; se le redirige al Historial en vez de dejarlo en un formulario
// muerto al que ya no llega por el menú.
function RequireEscritura({ children }: { children: ReactElement }) {
  const { perfil, loading } = usePerfil()

  if (loading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-gray-500">Cargando...</div>
  }

  if (perfil?.rol === 'admin_lectura') {
    return <Navigate to="/registros" replace />
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
        <Route
          path="/"
          element={
            <RequireEscritura>
              <EntryPage />
            </RequireEscritura>
          }
        />
        <Route path="/registro-lluvia" element={<RegistroLluviaPage />} />
        <Route path="/registros" element={<RecordsPage />} />
        <Route path="/reportes" element={<DashboardPage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
        <Route path="/especificaciones" element={<EspecificacionesPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/plan-general" element={<PlanGeneralPage />} />
        <Route path="/venta-canastillas" element={<VentaCanastillasPage />} />
        <Route path="/embolses" element={<EmbolsesPage />} />
        <Route
          path="/registro-embolse"
          element={
            <RequireEscritura>
              <RegistroEmbolsePage />
            </RequireEscritura>
          }
        />
        <Route path="/repiques" element={<RepiquesPage />} />
        <Route
          path="/registro-repique"
          element={
            <RequireEscritura>
              <RegistroRepiquePage />
            </RequireEscritura>
          }
        />
        <Route path="/recobro" element={<RecobroPage />} />
        <Route path="/evaluacion-banda" element={<EvaluacionBandaPage />} />
        <Route path="/perfil-racimo" element={<PerfilRacimoPage />} />
        <Route path="/ranking-marcas" element={<RankingMarcasPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <UpdatePrompt />
        <InstallBanner />
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

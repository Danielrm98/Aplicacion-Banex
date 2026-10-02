import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { usePerfil } from '../lib/usePerfil'
import { useColaSincronizacion } from '../lib/useColaSincronizacion'
import { BANEX_LOGO_URL } from '../lib/logo'
import TextSizeControl from './TextSizeControl'

const navItems = [
  { to: '/', label: 'Registrar', icon: '📝', end: true },
  { to: '/plan', label: 'Plan', icon: '🎯' },
  { to: '/plan-general', label: 'Plan general', icon: '📊' },
  { to: '/venta-canastillas', label: 'Venta canastillas', icon: '📦' },
  { to: '/embolses', label: 'Embolses', icon: '🎗️' },
  { to: '/registros', label: 'Historial', icon: '🗂️' },
  { to: '/reportes', label: 'Reportes', icon: '📈' },
  { to: '/especificaciones', label: 'Especificaciones', icon: '📄' },
  { to: '/catalogo', label: 'Catálogo', icon: '⚙️' },
]

const SOLO_ADMIN = ['/catalogo', '/plan-general']
const CLAVE_EXPANDIDO = 'approban_menu_expandido'

export default function Layout() {
  const { perfil } = usePerfil()
  const items = perfil?.rol === 'operador' ? navItems.filter((item) => !SOLO_ADMIN.includes(item.to)) : navItems
  const { pendientes, sincronizando, sincronizarAhora } = useColaSincronizacion()

  // En escritorio se recuerda si el menú queda expandido (con etiquetas) o
  // reducido a solo íconos; en celular siempre arranca cerrado (el ancho de
  // pantalla no alcanza para dejarlo abierto encima del contenido).
  const [expandido, setExpandido] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_EXPANDIDO) !== 'false'
    } catch {
      return true
    }
  })
  const [abiertoMovil, setAbiertoMovil] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_EXPANDIDO, String(expandido))
    } catch {
      // localStorage no disponible: no se recuerda la preferencia, sin más consecuencia.
    }
  }, [expandido])

  function alternarMenu() {
    setExpandido((v) => !v)
    setAbiertoMovil((v) => !v)
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-banex-800 bg-gradient-to-r from-banex-700 via-banex-700 to-banex-800 shadow-md">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dos botones (uno por tamaño de pantalla) en vez de uno solo con
                una condición combinada: así cada uno refleja únicamente su
                propio estado (el menú se abre distinto en celular que en
                escritorio) sin tener que detectar el ancho de pantalla en JS. */}
            <button
              type="button"
              onClick={alternarMenu}
              aria-label={abiertoMovil ? 'Contraer menú' : 'Expandir menú'}
              aria-expanded={abiertoMovil}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-banex-50 transition-colors hover:bg-black/20 sm:hidden"
            >
              <span className={`inline-block text-sm transition-transform duration-200 ${abiertoMovil ? '' : 'rotate-180'}`}>◀</span>
            </button>
            <button
              type="button"
              onClick={alternarMenu}
              aria-label={expandido ? 'Contraer menú' : 'Expandir menú'}
              aria-expanded={expandido}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-banex-50 transition-colors hover:bg-black/20 sm:flex"
            >
              <span className={`inline-block text-sm transition-transform duration-200 ${expandido ? '' : 'rotate-180'}`}>◀</span>
            </button>
            <img
              src={BANEX_LOGO_URL}
              alt="BANEX S.A."
              className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5 sm:h-10 sm:w-10"
            />
            <span className="text-sm font-semibold text-white">ApproBan</span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <TextSizeControl />
            <button
              onClick={() => supabase.auth.signOut()}
              className="shrink-0 text-xs text-banex-100 hover:text-white sm:text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {pendientes > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 sm:text-sm">
          📶 {pendientes} registro{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'} de sincronizar
          (sin conexión al guardar).{' '}
          <button
            onClick={sincronizarAhora}
            disabled={sincronizando}
            className="font-medium underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
          >
            {sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      <div className="flex items-stretch">
        {abiertoMovil && (
          <div
            onClick={() => setAbiertoMovil(false)}
            aria-hidden="true"
            className="fixed inset-0 z-10 bg-black/40 sm:hidden"
          />
        )}

        <aside
          className={`fixed top-[57px] bottom-0 left-0 z-20 w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 sm:static sm:z-0 sm:top-auto sm:bottom-auto sm:shrink-0 sm:translate-x-0 sm:transition-[width] ${
            abiertoMovil ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          } ${expandido ? 'sm:w-60' : 'sm:w-14'}`}
        >
          <nav className="flex h-full flex-col overflow-y-auto py-3">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                onClick={() => setAbiertoMovil(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-r-2 border-banex-600 bg-banex-50 text-banex-800'
                      : 'border-r-2 border-transparent text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <span className="shrink-0 text-base">{item.icon}</span>
                <span className={expandido ? 'inline' : 'sm:hidden'}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

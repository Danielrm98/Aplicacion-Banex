import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import banexLogo from '../assets/banex-logo.jpg'

const navItems = [
  { to: '/', label: 'Registrar', end: true },
  { to: '/plan', label: 'Plan' },
  { to: '/registros', label: 'Historial' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/catalogo', label: 'Catálogo' },
]

export default function Layout() {
  return (
    <div className="min-h-svh bg-gray-50 pb-14 sm:pb-0">
      <header className="border-b border-banex-800 bg-banex-700">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <img
              src={banexLogo}
              alt="BANEX S.A."
              className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5 sm:h-10 sm:w-10"
            />
            <span className="text-sm font-semibold text-white">ApproBan</span>
          </div>

          <nav className="hidden gap-1 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-white text-banex-800' : 'text-banex-50 hover:bg-banex-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => supabase.auth.signOut()}
            className="shrink-0 text-xs text-banex-100 hover:text-white sm:text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white sm:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 border-t-2 py-2.5 text-center text-xs font-medium ${
                isActive ? 'border-banex-600 text-banex-700' : 'border-transparent text-gray-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

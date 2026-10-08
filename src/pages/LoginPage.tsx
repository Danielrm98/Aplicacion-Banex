import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { saludoSegunHora } from '../lib/saludo'
import { BANEX_LOGO_URL } from '../lib/logo'
import { conLimite } from '../lib/promesaConLimite'
import { esErrorDeRed } from '../lib/colaRegistros'
import { guardarCredencialOffline, verificarCredencialOffline } from '../lib/credencialesLocal'
import { leerSesionGuardada } from '../lib/sesionLocal'

const DOMINIO_USUARIO = 'approban.local'
const LIMITE_MS = 8000

function emailDesdeUsuario(usuario: string): string {
  const limpio = usuario.trim().toLowerCase()
  // Las cuentas creadas antes de este cambio usan su correo real; los
  // usuarios nuevos (creados en Catálogo → Usuarios) solo tienen un nombre
  // de usuario, al que se le agrega un dominio interno para el login.
  return limpio.includes('@') ? limpio : `${limpio}@${DOMINIO_USUARIO}`
}

export default function LoginPage() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sinConexion, setSinConexion] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const actualizar = () => setSinConexion(!navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  // Sin señal no se puede validar la contraseña contra el servidor, pero si
  // este celular ya inició sesión antes con ese mismo usuario y contraseña,
  // se confirma contra la huella guardada de la última vez y se retoma esa
  // sesión guardada, en vez de obligar a tener conexión para poder entrar.
  async function intentarSinConexion(email: string) {
    const coincide = await verificarCredencialOffline(email, password)
    const sesionGuardada = leerSesionGuardada()
    const mismoUsuario = sesionGuardada?.user?.email?.toLowerCase() === email.toLowerCase()

    setLoading(false)
    if (coincide && sesionGuardada && mismoUsuario) {
      // AuthProvider vuelve a resolver la sesión guardada al recargar; es el
      // mismo camino que ya usa para seguir funcionando si se pierde la
      // señal a media sesión, solo que ahora arranca desde la pantalla de
      // inicio de sesión en vez de seguir ya adentro.
      window.location.reload()
      return
    }
    setError(
      coincide
        ? 'Sin señal y no hay una sesión guardada en este celular para este usuario. Conéctate al menos una vez para poder entrar sin señal la próxima vez.'
        : 'Sin señal: revisa tu usuario y contraseña, o conéctate para iniciar sesión por primera vez en este celular.',
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const email = emailDesdeUsuario(usuario)

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await intentarSinConexion(email)
      return
    }

    try {
      const { error } = await conLimite(supabase.auth.signInWithPassword({ email, password }), LIMITE_MS)
      if (error) {
        setLoading(false)
        setError('Usuario o contraseña incorrectos.')
        return
      }
      void guardarCredencialOffline(email, password)
      setLoading(false)
    } catch (err) {
      if (esErrorDeRed(err)) {
        await intentarSinConexion(email)
      } else {
        setLoading(false)
        setError('Usuario o contraseña incorrectos.')
      }
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-banex-700 via-banex-800 to-banex-900 px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(700px circle at 15% 15%, rgba(237, 183, 15, 0.18), transparent 55%), radial-gradient(800px circle at 85% 85%, rgba(255, 255, 255, 0.08), transparent 50%)',
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <img src={BANEX_LOGO_URL} alt="BANEX S.A." className="mx-auto mb-4 h-28 w-28 object-contain" />
        <h1 className="mb-1 text-center text-xl font-bold text-banex-900">ApproBan</h1>
        <p className="mb-6 text-center text-sm font-medium text-banex-700">{saludoSegunHora()}</p>

        {sinConexion && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            📶 Sin señal. Si ya iniciaste sesión antes en este celular, puedes entrar igual con tu mismo usuario y contraseña.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="usuario" className="mb-1 block text-sm font-medium text-gray-700">
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-banex-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import banexLogo from '../assets/banex-logo.jpg'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
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
        <img src={banexLogo} alt="BANEX S.A." className="mx-auto mb-4 h-28 w-28 object-contain" />
        <h1 className="mb-1 text-center text-xl font-bold text-banex-900">ApproBan</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Registro de producción de cajas de banano</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

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
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-banex-700 to-banex-900 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
        <img src={banexLogo} alt="BANEX S.A." className="mx-auto mb-4 h-28 w-28 object-contain" />
        <h1 className="mb-1 text-center text-xl font-semibold text-gray-900">ApproBan</h1>
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-banex-600 focus:outline-none"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-banex-600 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-banex-600 px-4 py-2 text-sm font-medium text-white hover:bg-banex-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

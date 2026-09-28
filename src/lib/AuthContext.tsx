import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { leerSesionGuardada } from './sesionLocal'

interface AuthContextValue {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true })

// supabase.auth.getSession() renueva el token si está por vencer, y esa
// petición no tiene límite de tiempo propio: sin señal en campo se queda
// esperando indefinidamente y la app nunca pasa de "Cargando...". Este
// límite corta esa espera; si se agota, se usa la sesión que ya quedó
// guardada en el dispositivo la última vez que sí hubo conexión, en vez de
// dejar al operario sin poder usar la app.
const LIMITE_MS = 4000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    const limite = new Promise<'limite'>((resolve) => setTimeout(() => resolve('limite'), LIMITE_MS))

    Promise.race([supabase.auth.getSession().then(({ data }) => data.session), limite])
      .catch(() => null)
      .then((resultado) => {
        if (!activo) return
        setSession(resultado === 'limite' || !resultado ? leerSesionGuardada() : resultado)
        setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (activo) setSession(newSession)
    })

    return () => {
      activo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

import type { Session } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const CLAVE_SESION = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

/**
 * Lee la sesión tal como la dejó guardada supabase-js en este dispositivo la
 * última vez que hubo conexión, sin tocar la red. Sirve de respaldo cuando
 * supabase.auth.getSession() se queda esperando una renovación de token que
 * nunca llega (sin señal en campo).
 */
export function leerSesionGuardada(): Session | null {
  try {
    const bruto = localStorage.getItem(CLAVE_SESION)
    if (!bruto) return null
    const datos = JSON.parse(bruto)
    return datos?.user?.id ? (datos as Session) : null
  } catch {
    return null
  }
}

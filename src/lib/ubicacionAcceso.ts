const SESSION_KEY = 'approban_ubicacion_desbloqueada'

export function ubicacionEstaDesbloqueada(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function desbloquearUbicacion(password: string): boolean {
  const esperado = import.meta.env.VITE_UBICACION_PASSWORD
  if (!esperado || password !== esperado) return false
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // sessionStorage no disponible; el desbloqueo solo dura esta vista
  }
  return true
}

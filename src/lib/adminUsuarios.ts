import { supabase } from './supabaseClient'

interface RespuestaError {
  error: string
}

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T | RespuestaError>('admin-usuarios', { body })
  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data) throw new Error((data as RespuestaError).error)
  return data as T
}

export function crearUsuario(input: {
  usuario: string
  password: string
  nombre: string | null
  rol: 'admin' | 'operador'
  finca: string | null
}) {
  return invocar<{ usuario: string; nombre: string | null; rol: string; finca: string | null }>({
    accion: 'crear',
    ...input,
  })
}

export function resetearPassword(usuario: string, password: string) {
  return invocar<{ ok: true }>({ accion: 'resetear_password', usuario, password })
}

export function eliminarUsuario(usuario: string) {
  return invocar<{ ok: true }>({ accion: 'eliminar', usuario })
}

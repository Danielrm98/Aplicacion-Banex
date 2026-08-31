import { supabase } from './supabaseClient'
import type { ProduccionHeaderInput } from '../types/produccion'
import type { RegistroResumenCompartir } from './shareSummary'

export interface ItemPendiente {
  id: string
  referencia: string
  cantidad_cajas: number
  peso_neto_kg: number
  cajas_20kg: number
}

export interface TransportePendiente {
  id: string
  tipo: string
  hora_llegada: string | null
  hora_salida: string | null
  placa: string | null
  sello: string | null
}

export interface RegistroPendiente {
  id: string
  userId: string
  header: ProduccionHeaderInput
  items: ItemPendiente[]
  transportes: TransportePendiente[]
  resumen: RegistroResumenCompartir
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

const CLAVE = 'approban_cola_registros_pendientes'

export function leerCola(): RegistroPendiente[] {
  try {
    const bruto = localStorage.getItem(CLAVE)
    return bruto ? (JSON.parse(bruto) as RegistroPendiente[]) : []
  } catch {
    return []
  }
}

function guardarCola(cola: RegistroPendiente[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola))
  } catch {
    // localStorage lleno o no disponible: el registro ya se intentó
    // enviar directo antes de llegar aquí, así que no se pierde el
    // trabajo capturado, solo no queda encolado para reintento.
  }
}

export function agregarACola(registro: RegistroPendiente) {
  const cola = leerCola()
  cola.push(registro)
  guardarCola(cola)
}

function quitarDeCola(id: string) {
  guardarCola(leerCola().filter((r) => r.id !== id))
}

function marcarIntento(id: string, error: string) {
  const cola = leerCola().map((r) => (r.id === id ? { ...r, intentos: r.intentos + 1, ultimoError: error } : r))
  guardarCola(cola)
}

/**
 * Distingue "no hay conexión / se cortó a media petición" de un error real
 * del servidor (validación, permisos, etc.) — solo lo primero amerita
 * encolar para reintentar; lo segundo hay que mostrárselo al usuario.
 */
export function esErrorDeRed(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase()
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')
  }
  return false
}

/**
 * Guarda un registro completo en Supabase. Usa upsert (no insert) con ids
 * generados en el dispositivo para que reintentar el mismo registro tras
 * un corte de conexión a medio guardar sea seguro y no duplique nada.
 */
export async function enviarRegistroPendiente(registro: RegistroPendiente): Promise<void> {
  const { error: headerError } = await supabase.from('producciones').upsert({
    id: registro.id,
    ...registro.header,
    notas: registro.header.notas || null,
    user_id: registro.userId,
  })
  if (headerError) throw headerError

  if (registro.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('produccion_items')
      .upsert(registro.items.map((it) => ({ ...it, produccion_id: registro.id })))
    if (itemsError) throw itemsError
  }

  if (registro.transportes.length > 0) {
    const { error: transportesError } = await supabase
      .from('transportes')
      .upsert(registro.transportes.map((t) => ({ ...t, produccion_id: registro.id })))
    if (transportesError) throw transportesError
  }
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarCola(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const registro of leerCola()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await enviarRegistroPendiente(registro)
      quitarDeCola(registro.id)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      marcarIntento(registro.id, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: leerCola().length }
}

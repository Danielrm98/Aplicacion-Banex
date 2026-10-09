import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_REPIQUES_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'
import type { RepiqueInput } from '../types/repique'

function claveDe(payload: RepiqueInput): string {
  return `${payload.lote_id}_${payload.anio_embolse}_${payload.semana_embolse}`
}

export interface RepiquePendiente {
  clave: string
  payload: RepiqueInput
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

/** Guarda la última versión de la celda; si el operario vuelve a cambiarla sin señal, reemplaza la anterior. */
export async function agregarRepiqueACola(payload: RepiqueInput): Promise<void> {
  const pendiente: RepiquePendiente = {
    clave: claveDe(payload),
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_REPIQUES_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaRepiques(): Promise<RepiquePendiente[]> {
  try {
    return await conAlmacen<RepiquePendiente[]>(ALMACEN_REPIQUES_PENDIENTES, 'readonly', (almacen) => almacen.getAll())
  } catch {
    return []
  }
}

export async function enviarRepique(payload: RepiqueInput): Promise<void> {
  const { error } = await supabase
    .from('repiques')
    .upsert(payload, { onConflict: 'lote_id,anio_embolse,semana_embolse' })
  if (error) throw error
}

async function quitarSiNoCambio(pendiente: RepiquePendiente) {
  const actual = await conAlmacen<RepiquePendiente | undefined>(ALMACEN_REPIQUES_PENDIENTES, 'readonly', (almacen) =>
    almacen.get(pendiente.clave),
  )
  if (actual && actual.creadoEn === pendiente.creadoEn) {
    await conAlmacen(ALMACEN_REPIQUES_PENDIENTES, 'readwrite', (almacen) => almacen.delete(pendiente.clave))
  }
}

/** Para que el operario o el administrador puedan descartar a mano, desde el detalle de pendientes, un repique que ya saben que quedó guardado de otra forma. */
export async function descartarRepiquePendiente(clave: string): Promise<void> {
  await conAlmacen(ALMACEN_REPIQUES_PENDIENTES, 'readwrite', (almacen) => almacen.delete(clave))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

async function marcarIntento(pendiente: RepiquePendiente, error: string) {
  await conAlmacen(ALMACEN_REPIQUES_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaRepiques(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaRepiques()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(enviarRepique(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarSiNoCambio(pendiente)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaRepiques()).length }
}

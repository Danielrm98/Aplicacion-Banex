import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_EMBOLSES_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'

export interface DiasEmbolse {
  lunes: number | null
  martes: number | null
  miercoles: number | null
  jueves: number | null
  viernes: number | null
  sabado: number | null
}

export interface PayloadEmbolse extends DiasEmbolse {
  lote_id: string
  user_id: string
  anio: number
  semana: number
  cantidad: number
  primera_vuelta: number
  segunda_vuelta: number
  debunching: number | null
}

export interface EmbolsePendiente {
  clave: string
  payload: PayloadEmbolse
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

function claveDe(payload: PayloadEmbolse): string {
  return `${payload.lote_id}_${payload.anio}_${payload.semana}`
}

/** Guarda la última versión de la celda; si el operario vuelve a cambiarla sin señal, reemplaza la anterior. */
export async function agregarEmbolseACola(payload: PayloadEmbolse): Promise<void> {
  const pendiente: EmbolsePendiente = {
    clave: claveDe(payload),
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_EMBOLSES_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaEmbolses(): Promise<EmbolsePendiente[]> {
  try {
    return await conAlmacen<EmbolsePendiente[]>(ALMACEN_EMBOLSES_PENDIENTES, 'readonly', (almacen) => almacen.getAll())
  } catch {
    return []
  }
}

export async function enviarEmbolse(payload: PayloadEmbolse): Promise<void> {
  const { error } = await supabase.from('embolses').upsert(payload, { onConflict: 'lote_id,anio,semana' })
  if (error) throw error
}

async function quitarSiNoCambio(pendiente: EmbolsePendiente) {
  const actual = await conAlmacen<EmbolsePendiente | undefined>(ALMACEN_EMBOLSES_PENDIENTES, 'readonly', (almacen) =>
    almacen.get(pendiente.clave),
  )
  if (actual && actual.creadoEn === pendiente.creadoEn) {
    await conAlmacen(ALMACEN_EMBOLSES_PENDIENTES, 'readwrite', (almacen) => almacen.delete(pendiente.clave))
  }
}

async function marcarIntento(pendiente: EmbolsePendiente, error: string) {
  await conAlmacen(ALMACEN_EMBOLSES_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaEmbolses(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaEmbolses()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(enviarEmbolse(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarSiNoCambio(pendiente)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaEmbolses()).length }
}

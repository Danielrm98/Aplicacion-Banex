import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_CENSO_PLANTAS_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'
import type { CensoPlantasInput } from '../types/censoPlantas'

function claveDe(payload: CensoPlantasInput): string {
  return `${payload.lote_id}_${payload.anio}_${payload.semana}`
}

export interface CensoPlantasPendiente {
  clave: string
  payload: CensoPlantasInput
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

/** Guarda la última versión de la celda; si el operario vuelve a cambiarla sin señal, reemplaza la anterior. */
export async function agregarCensoPlantasACola(payload: CensoPlantasInput): Promise<void> {
  const pendiente: CensoPlantasPendiente = {
    clave: claveDe(payload),
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaCensoPlantas(): Promise<CensoPlantasPendiente[]> {
  try {
    return await conAlmacen<CensoPlantasPendiente[]>(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readonly', (almacen) => almacen.getAll())
  } catch {
    return []
  }
}

export async function enviarCensoPlantas(payload: CensoPlantasInput): Promise<void> {
  const { error } = await supabase.from('censo_plantas').upsert(payload, { onConflict: 'lote_id,anio,semana' })
  if (error) throw error
}

async function quitarSiNoCambio(pendiente: CensoPlantasPendiente) {
  const actual = await conAlmacen<CensoPlantasPendiente | undefined>(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readonly', (almacen) =>
    almacen.get(pendiente.clave),
  )
  if (actual && actual.creadoEn === pendiente.creadoEn) {
    await conAlmacen(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readwrite', (almacen) => almacen.delete(pendiente.clave))
  }
}

/** Para que el operario o el administrador puedan descartar a mano, desde el detalle de pendientes, un censo que ya saben que quedó guardado de otra forma. */
export async function descartarCensoPlantasPendiente(clave: string): Promise<void> {
  await conAlmacen(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readwrite', (almacen) => almacen.delete(clave))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

async function marcarIntento(pendiente: CensoPlantasPendiente, error: string) {
  await conAlmacen(ALMACEN_CENSO_PLANTAS_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaCensoPlantas(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaCensoPlantas()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(enviarCensoPlantas(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarSiNoCambio(pendiente)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaCensoPlantas()).length }
}

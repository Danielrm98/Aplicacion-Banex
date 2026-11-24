import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_COSECHA_EDAD_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'
import type { CosechaPorEdadInput } from '../types/escaleraProduccion'

export interface CosechaPorEdadPendiente {
  clave: string
  payload: CosechaPorEdadInput & { user_id: string }
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

function claveDe(payload: CosechaPorEdadInput): string {
  return `${payload.finca}_${payload.anio}_${payload.semana}_${payload.edad_semanas}`
}

/** Guarda la última versión de la celda; si el operario vuelve a cambiarla sin señal, reemplaza la anterior. */
export async function agregarCosechaPorEdadACola(payload: CosechaPorEdadInput & { user_id: string }): Promise<void> {
  const pendiente: CosechaPorEdadPendiente = {
    clave: claveDe(payload),
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaCosechaPorEdad(): Promise<CosechaPorEdadPendiente[]> {
  try {
    return await conAlmacen<CosechaPorEdadPendiente[]>(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readonly', (almacen) =>
      almacen.getAll(),
    )
  } catch {
    return []
  }
}

export async function enviarCosechaPorEdad(payload: CosechaPorEdadInput & { user_id: string }): Promise<void> {
  const { error } = await supabase.from('cosecha_por_edad').upsert(payload, { onConflict: 'finca,anio,semana,edad_semanas' })
  if (error) throw error
}

async function quitarSiNoCambio(pendiente: CosechaPorEdadPendiente) {
  const actual = await conAlmacen<CosechaPorEdadPendiente | undefined>(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readonly', (almacen) =>
    almacen.get(pendiente.clave),
  )
  if (actual && actual.creadoEn === pendiente.creadoEn) {
    await conAlmacen(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readwrite', (almacen) => almacen.delete(pendiente.clave))
  }
}

/** Para que el operario o el administrador puedan descartar a mano, desde el detalle de pendientes, una celda que ya saben que quedó guardada de otra forma. */
export async function descartarCosechaPorEdadPendiente(clave: string): Promise<void> {
  await conAlmacen(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readwrite', (almacen) => almacen.delete(clave))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

async function marcarIntento(pendiente: CosechaPorEdadPendiente, error: string) {
  await conAlmacen(ALMACEN_COSECHA_EDAD_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaCosechaPorEdad(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaCosechaPorEdad()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(enviarCosechaPorEdad(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarSiNoCambio(pendiente)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaCosechaPorEdad()).length }
}

import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_EVALUACION_BANDA_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'
import { guardarEvaluacionBanda, type EvaluacionBandaPayload } from './useEvaluacionesBanda'

export interface EvaluacionBandaPendiente {
  id: string
  payload: EvaluacionBandaPayload
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

export async function agregarEvaluacionBandaACola(payload: EvaluacionBandaPayload): Promise<void> {
  const pendiente: EvaluacionBandaPendiente = {
    id: payload.id,
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_EVALUACION_BANDA_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaEvaluacionBanda(): Promise<EvaluacionBandaPendiente[]> {
  try {
    return await conAlmacen<EvaluacionBandaPendiente[]>(ALMACEN_EVALUACION_BANDA_PENDIENTES, 'readonly', (almacen) =>
      almacen.getAll(),
    )
  } catch {
    return []
  }
}

/** Para bloquear un segundo guardado del mismo formulario mientras el primero
 * sigue sin sincronizar (p.ej. si el operario le da varias veces al botón). */
export async function hayEvaluacionBandaPendiente(id: string): Promise<boolean> {
  return (await leerColaEvaluacionBanda()).some((p) => p.id === id)
}

function quitarDeCola(id: string) {
  return conAlmacen(ALMACEN_EVALUACION_BANDA_PENDIENTES, 'readwrite', (almacen) => almacen.delete(id))
}

/** Para que el operario o el administrador puedan descartar a mano, desde el detalle de pendientes, una que ya saben que quedó cubierta de otra forma. */
export async function descartarEvaluacionBandaPendiente(id: string): Promise<void> {
  await quitarDeCola(id)
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

async function marcarIntento(pendiente: EvaluacionBandaPendiente, error: string) {
  await conAlmacen(ALMACEN_EVALUACION_BANDA_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaEvaluacionBanda(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaEvaluacionBanda()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(guardarEvaluacionBanda(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarDeCola(pendiente.id)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  if (sincronizados > 0) window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
  return { sincronizados, pendientes: (await leerColaEvaluacionBanda()).length }
}

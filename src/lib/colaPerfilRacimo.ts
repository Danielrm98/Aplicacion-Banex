import { conLimite } from './promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from './colaRegistros'
import { ALMACEN_PERFIL_RACIMO_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'
import { guardarPerfilRacimo, type PerfilRacimoPayload } from './usePerfilesRacimo'

export interface PerfilRacimoPendiente {
  id: string
  payload: PerfilRacimoPayload
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

export async function agregarPerfilRacimoACola(payload: PerfilRacimoPayload): Promise<void> {
  const pendiente: PerfilRacimoPendiente = {
    id: payload.id,
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    ultimoError: null,
  }
  await conAlmacen(ALMACEN_PERFIL_RACIMO_PENDIENTES, 'readwrite', (almacen) => almacen.put(pendiente))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (IndexedDB no disponible) se trata como "sin pendientes". */
export async function leerColaPerfilRacimo(): Promise<PerfilRacimoPendiente[]> {
  try {
    return await conAlmacen<PerfilRacimoPendiente[]>(ALMACEN_PERFIL_RACIMO_PENDIENTES, 'readonly', (almacen) =>
      almacen.getAll(),
    )
  } catch {
    return []
  }
}

/** Para bloquear un segundo guardado del mismo formulario mientras el primero
 * sigue sin sincronizar (p.ej. si el operario le da varias veces al botón). */
export async function hayPerfilRacimoPendiente(id: string): Promise<boolean> {
  return (await leerColaPerfilRacimo()).some((p) => p.id === id)
}

function quitarDeCola(id: string) {
  return conAlmacen(ALMACEN_PERFIL_RACIMO_PENDIENTES, 'readwrite', (almacen) => almacen.delete(id))
}

/** Para que el operario o el administrador puedan descartar a mano, desde el detalle de pendientes, uno que ya saben que quedó cubierto de otra forma. */
export async function descartarPerfilRacimoPendiente(id: string): Promise<void> {
  await quitarDeCola(id)
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

async function marcarIntento(pendiente: PerfilRacimoPendiente, error: string) {
  await conAlmacen(ALMACEN_PERFIL_RACIMO_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...pendiente, intentos: pendiente.intentos + 1, ultimoError: error }),
  )
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaPerfilRacimo(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const pendiente of await leerColaPerfilRacimo()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(guardarPerfilRacimo(pendiente.payload), LIMITE_ENVIO_MS)
      await quitarDeCola(pendiente.id)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(pendiente, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  if (sincronizados > 0) window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
  return { sincronizados, pendientes: (await leerColaPerfilRacimo()).length }
}

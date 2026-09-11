import { supabase } from './supabaseClient'
import { esErrorDeRed } from './colaRegistros'
import { subirFacturaCanastilla } from './facturasCanastillas'

/**
 * Cola de "Venta de canastillas" pendientes de sincronizar. Usa IndexedDB
 * (no localStorage, como la cola de registros de producción) porque cada
 * elemento incluye la foto de la factura como Blob: localStorage solo
 * guarda texto y tiene muy poco espacio (podría llenarse con una sola foto
 * y romper también la otra cola).
 */
export interface VentaPendiente {
  id: string
  userId: string
  finca: string
  fecha: string
  semana: number
  cantidad: number
  cantidadObsequio: number
  cantidadRepique: number
  notas: string | null
  foto: Blob
  fotoNombre: string
  fotoTipo: string
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

const DB_NOMBRE = 'approban_offline'
const DB_VERSION = 1
const ALMACEN = 'ventas_canastillas_pendientes'

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(ALMACEN)) {
        req.result.createObjectStore(ALMACEN, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function conAlmacen<T>(modo: IDBTransactionMode, fn: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(ALMACEN, modo)
      const req = fn(tx.objectStore(ALMACEN))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function agregarVentaACola(venta: VentaPendiente): Promise<void> {
  await conAlmacen('readwrite', (almacen) => almacen.put(venta))
}

/** Si falla (navegador sin IndexedDB, modo privado, etc.) se trata como "sin pendientes". */
export async function leerColaVentas(): Promise<VentaPendiente[]> {
  try {
    return await conAlmacen<VentaPendiente[]>('readonly', (almacen) => almacen.getAll())
  } catch {
    return []
  }
}

async function quitarDeCola(id: string) {
  await conAlmacen('readwrite', (almacen) => almacen.delete(id))
}

async function marcarIntento(venta: VentaPendiente, error: string) {
  await conAlmacen('readwrite', (almacen) =>
    almacen.put({ ...venta, intentos: venta.intentos + 1, ultimoError: error }),
  )
}

/** Sube la foto y crea la venta. Usa insert (no upsert): a diferencia de la
 * cola de registros, aquí editar/eliminar una venta ya guardada queda
 * reservado al administrador (control de las cifras de venta), así que un
 * operario no tiene permiso para el "update" que un upsert necesitaría. La
 * foto sí se sube con upsert (ruta fija por venta) para que reintentar tras
 * un corte de conexión no falle si ya se había subido antes.
 */
export async function enviarVentaPendiente(venta: VentaPendiente): Promise<void> {
  const archivo = new File([venta.foto], venta.fotoNombre, { type: venta.fotoTipo })
  const rutaFactura = await subirFacturaCanastilla(venta.finca, archivo, venta.id)

  const { error } = await supabase.from('ventas_canastillas').insert({
    id: venta.id,
    user_id: venta.userId,
    finca: venta.finca,
    fecha: venta.fecha,
    semana: venta.semana,
    cantidad: venta.cantidad,
    cantidad_obsequio: venta.cantidadObsequio,
    cantidad_repique: venta.cantidadRepique,
    factura_path: rutaFactura,
    notas: venta.notas,
  })
  if (error) throw error
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaVentas(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const venta of await leerColaVentas()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await enviarVentaPendiente(venta)
      await quitarDeCola(venta.id)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(venta, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaVentas()).length }
}

// Una sola base de IndexedDB para todo lo que la app guarda sin conexión.
// Cada módulo abre la base con esta misma versión: si una versión nueva agrega
// un almacén, todos lo ven al abrir.
const DB_NOMBRE = 'approban_offline'
const DB_VERSION = 4

export const ALMACEN_VENTAS_PENDIENTES = 'ventas_canastillas_pendientes'
export const ALMACEN_EMBOLSES_PENDIENTES = 'embolses_pendientes'
export const ALMACEN_REPIQUES_PENDIENTES = 'repiques_pendientes'
export const ALMACEN_CENSO_PLANTAS_PENDIENTES = 'censo_plantas_pendientes'
export const ALMACEN_CACHE = 'cache'

/** Aviso para que el contador de pendientes se actualice al encolar, sin esperar a una sincronización. */
export const EVENTO_COLA_CAMBIO = 'approban-cola-cambio'

const ALMACENES = [
  { nombre: ALMACEN_VENTAS_PENDIENTES, keyPath: 'id' },
  { nombre: ALMACEN_EMBOLSES_PENDIENTES, keyPath: 'clave' },
  { nombre: ALMACEN_REPIQUES_PENDIENTES, keyPath: 'clave' },
  { nombre: ALMACEN_CENSO_PLANTAS_PENDIENTES, keyPath: 'clave' },
  { nombre: ALMACEN_CACHE, keyPath: 'clave' },
]

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const { nombre, keyPath } of ALMACENES) {
        if (!req.result.objectStoreNames.contains(nombre)) {
          req.result.createObjectStore(nombre, { keyPath })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function conAlmacen<T>(
  nombre: string,
  modo: IDBTransactionMode,
  fn: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrirDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(nombre, modo)
      const req = fn(tx.objectStore(nombre))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Respuesta guardada de la última vez que hubo conexión; null si no hay ninguna o no se puede leer. */
export async function leerCacheIdb<T>(clave: string): Promise<T | null> {
  try {
    const fila = await conAlmacen<{ clave: string; data: T } | undefined>(ALMACEN_CACHE, 'readonly', (almacen) =>
      almacen.get(clave),
    )
    return fila ? fila.data : null
  } catch {
    return null
  }
}

export async function guardarCacheIdb<T>(clave: string, data: T): Promise<void> {
  try {
    await conAlmacen(ALMACEN_CACHE, 'readwrite', (almacen) => almacen.put({ clave, data }))
  } catch {
    // Sin IndexedDB no queda respaldo sin señal, pero la app sigue funcionando con conexión.
  }
}

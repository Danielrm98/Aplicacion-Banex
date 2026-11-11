import { limpiarCacheIdb } from './bdOffline'

const LIMITE_MS_DEFECTO = 4000
const PREFIJO_CACHE = 'approban_cache_'
const CLAVE_ULTIMO_USUARIO = 'approban_ultimo_usuario_id'

// AuthContext puede disparar la resolución de la sesión por dos caminos
// casi al mismo tiempo al cargar la página (la consulta directa y el
// propio listener de supabase-js). Sin esto, ambos entraban a la vez a
// decidir si tocaba limpiar, y si el segundo llegaba tarde -ya con datos
// recién guardados en caché por el primero- terminaba borrando lo que se
// acababa de traer de verdad, haciendo parecer "desaparecida" información
// que sí estaba bien guardada en el servidor. Esto hace que las llamadas
// que coinciden se resuelvan juntas, una sola vez.
let enProceso: Promise<void> | null = null

async function limpiarSiCambioDeUsuario(userId: string): Promise<void> {
  try {
    const anterior = localStorage.getItem(CLAVE_ULTIMO_USUARIO)
    if (anterior && anterior !== userId) {
      for (const clave of Object.keys(localStorage)) {
        if (clave.startsWith(PREFIJO_CACHE)) localStorage.removeItem(clave)
      }
      await limpiarCacheIdb()
    }
    localStorage.setItem(CLAVE_ULTIMO_USUARIO, userId)
  } catch {
    // localStorage no disponible: no hay caché que limpiar, sin consecuencia.
  }
}

/**
 * El caché vive en localStorage (claves fijas como "approban_cache_fincas")
 * y en IndexedDB (embolses, repiques, cosecha, etc.), ninguno separado por
 * usuario. Si en el mismo dispositivo/navegador antes entró otra cuenta,
 * al iniciar sesión con una cuenta distinta se podía ver lo que había
 * quedado cacheado de esa otra cuenta. Se borra todo (ambos almacenes)
 * solo cuando de verdad cambia el usuario con sesión activa en este
 * dispositivo — nunca en cada carga de página normal con la misma cuenta,
 * para no dejar a nadie sin su respaldo local si la conexión está lenta.
 */
export function limpiarCacheSiCambioDeUsuario(userId: string): Promise<void> {
  if (!enProceso) {
    enProceso = limpiarSiCambioDeUsuario(userId).finally(() => {
      enProceso = null
    })
  }
  return enProceso
}

interface ResultadoConsulta<T> {
  data: T | null
  error: { message: string } | null
}

/**
 * Ejecuta una consulta a Supabase con un límite de tiempo. Si no responde a
 * tiempo (o falla) y hay un resultado guardado de la última vez que sí hubo
 * conexión, se usa ese en vez de dejar al operario sin catálogo — pensado
 * para datos que casi no cambian (fincas, referencias, perfil) y que se
 * necesitan para registrar producción aunque el celular esté sin señal.
 */
export async function conCacheLocal<T>(
  clave: string,
  // PromiseLike y no Promise: los builders de supabase-js son "thenables"
  // pero no implementan toda la interfaz de Promise (catch/finally/...).
  consulta: () => PromiseLike<ResultadoConsulta<T>>,
  // Respaldo incluido en el propio build (ver src/data/*Base.json), solo para
  // un dispositivo que nunca tuvo conexión con esta versión de la app y por
  // lo tanto todavía no tiene nada en su caché local.
  respaldoBase?: T,
  // Para consultas que piden varias páginas seguidas (como embolses, que ya
  // supera las 1000 filas por página de PostgREST) el límite por defecto se
  // queda corto; se puede alargar sin afectar al resto de catálogos.
  limiteMs = LIMITE_MS_DEFECTO,
): Promise<{ data: T | null; error: string | null }> {
  const sinConexion = typeof navigator !== 'undefined' && navigator.onLine === false
  const limite = new Promise<'limite'>((resolve) => setTimeout(() => resolve('limite'), limiteMs))

  let resultado: ResultadoConsulta<T> | 'limite'
  if (sinConexion) {
    resultado = 'limite'
  } else {
    try {
      resultado = await Promise.race([consulta(), limite])
    } catch (err) {
      resultado = { data: null, error: { message: err instanceof Error ? err.message : 'Error de red' } }
    }
  }

  if (resultado === 'limite' || resultado.error) {
    const cacheado = leerCacheLocal<T>(clave)
    if (cacheado !== null) return { data: cacheado, error: null }
    if (respaldoBase !== undefined) return { data: respaldoBase, error: null }
    return { data: null, error: resultado === 'limite' ? 'Sin conexión.' : resultado.error!.message }
  }

  guardarCache(clave, resultado.data)
  return { data: resultado.data, error: null }
}

export function leerCacheLocal<T>(clave: string): T | null {
  try {
    const bruto = localStorage.getItem(clave)
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

function guardarCache<T>(clave: string, data: T | null) {
  try {
    if (data === null) return
    localStorage.setItem(clave, JSON.stringify(data))
  } catch {
    // localStorage lleno o no disponible: no queda respaldo para la próxima
    // vez sin señal, pero no afecta el uso actual.
  }
}

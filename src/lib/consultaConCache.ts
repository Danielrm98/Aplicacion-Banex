const LIMITE_MS_DEFECTO = 4000
const PREFIJO_CACHE = 'approban_cache_'
const CLAVE_ULTIMO_USUARIO = 'approban_ultimo_usuario_id'

/**
 * Este caché vive en localStorage sin separar por usuario (son claves fijas
 * como "approban_cache_fincas"). Si en el mismo dispositivo/navegador antes
 * entró otra cuenta con más acceso (por ejemplo un admin), al iniciar sesión
 * con una cuenta distinta se vería por un instante — o de forma inconsistente
 * según cuándo termine de llegar la respuesta real — lo que había quedado
 * cacheado de esa otra cuenta. Se borra todo el caché apenas se detecta que
 * cambió el usuario que tiene sesión activa en este dispositivo.
 */
export function limpiarCacheSiCambioDeUsuario(userId: string) {
  try {
    const anterior = localStorage.getItem(CLAVE_ULTIMO_USUARIO)
    if (anterior && anterior !== userId) {
      for (const clave of Object.keys(localStorage)) {
        if (clave.startsWith(PREFIJO_CACHE)) localStorage.removeItem(clave)
      }
    }
    localStorage.setItem(CLAVE_ULTIMO_USUARIO, userId)
  } catch {
    // localStorage no disponible: no hay caché que limpiar, sin consecuencia.
  }
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

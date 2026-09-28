const LIMITE_MS = 4000

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
): Promise<{ data: T | null; error: string | null }> {
  const limite = new Promise<'limite'>((resolve) => setTimeout(() => resolve('limite'), LIMITE_MS))

  let resultado: ResultadoConsulta<T> | 'limite'
  try {
    resultado = await Promise.race([consulta(), limite])
  } catch (err) {
    resultado = { data: null, error: { message: err instanceof Error ? err.message : 'Error de red' } }
  }

  if (resultado === 'limite' || resultado.error) {
    const cacheado = leerCache<T>(clave)
    if (cacheado !== null) return { data: cacheado, error: null }
    if (respaldoBase !== undefined) return { data: respaldoBase, error: null }
    return { data: null, error: resultado === 'limite' ? 'Sin conexión.' : resultado.error!.message }
  }

  guardarCache(clave, resultado.data)
  return { data: resultado.data, error: null }
}

function leerCache<T>(clave: string): T | null {
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

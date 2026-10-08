import { supabase } from './supabaseClient'
import { leerCacheIdb, guardarCacheIdb } from './bdOffline'
import { esErrorDeRed } from './colaRegistros'

const BUCKET = 'especificaciones'

function rutaPara(marca: string): string {
  return `${marca}.pdf`
}

function claveCachePdf(ruta: string): string {
  return `especificacion_pdf_${ruta}`
}

export async function subirEspecificacionPdf(marca: string, file: File): Promise<string> {
  const ruta = rutaPara(marca)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { upsert: true, contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase
    .from('referencias')
    .update({ especificacion_pdf_path: ruta })
    .eq('marca', marca)
  if (updateError) throw updateError

  return ruta
}

export async function eliminarEspecificacionPdf(marca: string, ruta: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([ruta])
  if (removeError) throw removeError

  const { error: updateError } = await supabase
    .from('referencias')
    .update({ especificacion_pdf_path: null })
    .eq('marca', marca)
  if (updateError) throw updateError
}

export async function urlEspecificacionPdf(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300)
  if (error) throw error
  return data.signedUrl
}

/**
 * Trae el PDF (y lo guarda en el celular para la próxima vez) si hay señal;
 * sin señal, usa la última copia guardada en este dispositivo. Así "Ver PDF"
 * y "Descargar" funcionan sin conexión una vez que alguien lo abrió o lo
 * descargó al menos una vez con señal.
 */
async function obtenerBlobPdf(ruta: string): Promise<{ blob: Blob; desdeCache: boolean }> {
  const clave = claveCachePdf(ruta)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const cacheado = await leerCacheIdb<Blob>(clave)
    if (cacheado) return { blob: cacheado, desdeCache: true }
    throw new Error('Sin señal y todavía no tienes este PDF guardado en este celular. Ábrelo una vez con conexión para consultarlo después sin señal.')
  }

  try {
    const url = await urlEspecificacionPdf(ruta)
    const respuesta = await fetch(url)
    if (!respuesta.ok) throw new Error('No se pudo descargar el PDF.')
    const blob = await respuesta.blob()
    await guardarCacheIdb(clave, blob)
    return { blob, desdeCache: false }
  } catch (err) {
    const cacheado = await leerCacheIdb<Blob>(clave)
    if (cacheado) return { blob: cacheado, desdeCache: true }
    // navigator.onLine no siempre baja a tiempo con señal intermitente; si la
    // falla fue justo de red (y no, por ejemplo, un PDF corrupto), igual se
    // explica como falta de señal en vez de mostrar el error técnico crudo.
    if (esErrorDeRed(err)) {
      throw new Error(
        'Sin señal y todavía no tienes este PDF guardado en este celular. Ábrelo una vez con conexión para consultarlo después sin señal.',
      )
    }
    throw err instanceof Error ? err : new Error('No se pudo abrir el PDF.')
  }
}

/** Abre el PDF en una pestaña nueva; devuelve si lo que se ve es la copia guardada en el celular (no la más reciente). */
export async function abrirEspecificacionPdf(ruta: string): Promise<{ desdeCache: boolean }> {
  const { blob, desdeCache } = await obtenerBlobPdf(ruta)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  // No se revoca de inmediato: la pestaña nueva necesita la URL mientras el PDF sigue cargado ahí.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { desdeCache }
}

/**
 * A diferencia de "Ver PDF" (lo abre en una pestaña), esto además fuerza la
 * descarga del archivo al dispositivo, para tenerlo disponible también desde
 * fuera de la aplicación.
 */
export async function descargarEspecificacionPdf(ruta: string, nombreArchivo: string): Promise<void> {
  const { blob } = await obtenerBlobPdf(ruta)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombreArchivo
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Sube el PDF de especificaciones de una marca que todavía no está
 * registrada como referencia del catálogo de producción (por ejemplo,
 * porque la especificación cambió de versión antes de que se defina o se
 * necesite crear la referencia productiva).
 */
export async function agregarEspecificacionMarca(marca: string, file: File): Promise<string> {
  const ruta = rutaPara(marca)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { upsert: true, contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  const { error: upsertError } = await supabase
    .from('especificaciones_marcas')
    .upsert({ marca, pdf_path: ruta, updated_at: new Date().toISOString() })
  if (upsertError) throw upsertError

  return ruta
}

export async function eliminarEspecificacionMarca(marca: string, ruta: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([ruta])
  if (removeError) throw removeError

  const { error: deleteError } = await supabase.from('especificaciones_marcas').delete().eq('marca', marca)
  if (deleteError) throw deleteError
}

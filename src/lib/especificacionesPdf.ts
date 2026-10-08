import { supabase } from './supabaseClient'

const BUCKET = 'especificaciones'

function rutaPara(marca: string): string {
  return `${marca}.pdf`
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
 * A diferencia de "Ver PDF" (lo abre en una pestaña), esto fuerza la
 * descarga del archivo al dispositivo: necesita señal para traerlo, pero una
 * vez descargado queda disponible sin conexión en el celular del operario.
 */
export async function descargarEspecificacionPdf(ruta: string, nombreArchivo: string): Promise<void> {
  const url = await urlEspecificacionPdf(ruta)
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error('No se pudo descargar el PDF.')
  const blob = await respuesta.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = nombreArchivo
  link.click()
  URL.revokeObjectURL(objectUrl)
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

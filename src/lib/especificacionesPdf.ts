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

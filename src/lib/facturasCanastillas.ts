import { supabase } from './supabaseClient'

const BUCKET = 'facturas-canastillas'

// La ruta empieza con "<finca>/" porque las políticas de Storage filtran el
// acceso de lectura/escritura según ese primer segmento (misma finca del
// operario, o admin). `idArchivo` permite fijar un nombre determinado (en
// vez de uno aleatorio) para que la cola de sincronización sin conexión
// pueda reintentar la misma subida tras un corte de conexión sin duplicar
// el archivo; se sube con upsert para que ese reintento no falle con
// "el archivo ya existe".
export async function subirFacturaCanastilla(finca: string, file: File, idArchivo?: string): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const ruta = `${finca}/${idArchivo ?? crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { contentType: file.type || 'image/jpeg', upsert: true })
  if (error) throw error
  return ruta
}

export async function eliminarFacturaCanastilla(ruta: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([ruta])
  if (error) throw error
}

export async function urlFacturaCanastilla(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300)
  if (error) throw error
  return data.signedUrl
}

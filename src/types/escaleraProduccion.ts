// Unión de los dos rangos que existen en la app: el formulario diario de
// "Registrar" captura racimos por edad de 7 a 12 semanas (SEMANAS_RACIMO,
// ver types/produccion.ts), y el histórico importado del Excel trae 8 a
// 13. Se usa el rango completo para no perder ninguno de los dos.
export const EDADES_COSECHA = [7, 8, 9, 10, 11, 12, 13] as const
export type EdadCosecha = (typeof EDADES_COSECHA)[number]

export interface CosechaPorEdad {
  id: string
  user_id: string
  finca: string
  anio: number
  semana: number
  edad_semanas: EdadCosecha
  racimos: number
  created_at: string
}

export type CosechaPorEdadInput = Omit<CosechaPorEdad, 'id' | 'user_id' | 'created_at'>

export interface EmbolseHistorico {
  finca: string
  anio: number
  semana: number
  hectareas: number | null
  bell_por_ha: number | null
  emb_real: number | null
}

export interface ModeloEdad {
  finca: string
  edad_semanas: EdadCosecha
  porcentaje: number
  updated_at: string
  updated_by: string | null
}

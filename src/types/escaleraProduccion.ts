export const EDADES_COSECHA = [8, 9, 10, 11, 12, 13] as const
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

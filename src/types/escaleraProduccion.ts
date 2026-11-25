// Rango de edad que usa la escalera para sus cálculos: 8 a 12 semanas. Se
// deja fuera la semana 7 (a pedido del usuario — esa edad resulta poco
// confiable, muy pocos racimos reales caen ahí) y la 13 (la cola del
// histórico importado del Excel, igual de rara). El formulario diario de
// "Registrar" sí sigue capturando 7 a 12 (SEMANAS_RACIMO, en
// types/produccion.ts) para otras pantallas de la app; la escalera
// simplemente no usa su columna de la semana 7.
export const EDADES_COSECHA = [8, 9, 10, 11, 12] as const
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

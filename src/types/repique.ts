export interface Repique {
  id: string
  lote_id: string
  user_id: string
  anio_reporte: number
  semana_reporte: number
  anio_embolse: number
  semana_embolse: number
  edad_semanas: number
  cantidad: number
  created_at: string
}

export type RepiqueInput = Omit<Repique, 'id' | 'created_at'>

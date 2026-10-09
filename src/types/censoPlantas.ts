export interface CensoPlantas {
  id: string
  lote_id: string
  user_id: string
  anio: number
  semana: number
  paridas: number
  sin_parir: number
  sin_identificar: number
  created_at: string
}

export type CensoPlantasInput = Omit<CensoPlantas, 'id' | 'created_at'>

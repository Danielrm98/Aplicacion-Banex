export interface EvaluacionBandaItem {
  id: string
  evaluacion_id: string
  grupo: string
  defecto: string
  cantidad: number
  created_at: string
}

export interface EvaluacionBanda {
  id: string
  user_id: string
  finca: string
  fecha: string
  semana: number
  merma_finca: number | null
  created_at: string
  items: EvaluacionBandaItem[]
}

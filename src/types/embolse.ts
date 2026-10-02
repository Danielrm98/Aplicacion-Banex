export interface Embolse {
  id: string
  lote_id: string
  user_id: string
  anio: number
  semana: number
  cantidad: number
  created_at: string
}

export type EmbolseInput = Omit<Embolse, 'id' | 'created_at'>

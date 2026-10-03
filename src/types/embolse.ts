export interface Embolse {
  id: string
  lote_id: string
  user_id: string
  anio: number
  semana: number
  cantidad: number
  primera_vuelta: number | null
  segunda_vuelta: number | null
  debunching: number | null
  lunes: number | null
  martes: number | null
  miercoles: number | null
  jueves: number | null
  viernes: number | null
  sabado: number | null
  created_at: string
}

export type EmbolseInput = Omit<Embolse, 'id' | 'created_at'>

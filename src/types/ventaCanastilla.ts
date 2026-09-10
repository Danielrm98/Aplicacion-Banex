export interface VentaCanastilla {
  id: string
  user_id: string
  finca: string
  fecha: string
  semana: number
  cantidad: number
  factura_path: string
  notas: string | null
  created_at: string
}

export type VentaCanastillaInput = Omit<VentaCanastilla, 'id' | 'user_id' | 'created_at'>

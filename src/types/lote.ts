export interface Lote {
  id: string
  finca: string
  nombre: string
  hectareas: number | null
  created_at: string
}

export type LoteInput = Omit<Lote, 'id' | 'created_at'>

import type { TIPOS_TRANSPORTE } from './produccion'

// Flota fija y compartida entre todas las fincas (no numeración por finca).
export const UNIDADES_TRANSPORTE = [1, 2, 3, 4] as const

export interface TransporteUnidad {
  id: string
  user_id: string
  finca: string
  fecha: string
  numero_unidad: number
  tipo: (typeof TIPOS_TRANSPORTE)[number] | null
  placa: string | null
  numero_contenedor: string | null
  sello_entrada: string | null
  sello_salida: string | null
  hora_llegada: string | null
  hora_salida: string | null
  created_at: string
}

export type TransporteUnidadPlanInput = Pick<TransporteUnidad, 'finca' | 'fecha' | 'numero_unidad'>

/** Verde (ya se registró la llegada) solo cuando se sabe el tipo y se llenó
 * la hora de llegada/entrada — mientras falte cualquiera de los dos, queda
 * en rojo (pendiente), sin importar qué tan completos estén los demás
 * campos. */
export function transporteRegistrada(u: TransporteUnidad): boolean {
  return u.tipo !== null && u.hora_llegada !== null
}

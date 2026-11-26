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
  cantidad_pallets: number | null
  placa: string | null
  numero_contenedor: string | null
  sello_entrada: string | null
  sello_salida: string | null
  hora_llegada: string | null
  hora_salida: string | null
  created_at: string
}

export type TransporteUnidadPlanInput = Pick<TransporteUnidad, 'finca' | 'fecha' | 'numero_unidad' | 'tipo' | 'cantidad_pallets'>

/** Verde (ya se registró la llegada) solo cuando se sabe el tipo y se llenó
 * la hora de llegada/entrada — mientras falte cualquiera de los dos, queda
 * en rojo (pendiente), sin importar qué tan completos estén los demás
 * campos. */
export function transporteRegistrada(u: TransporteUnidad): boolean {
  return u.tipo !== null && u.hora_llegada !== null
}

/** Una unidad puede repetirse en la misma finca/fecha (varios recorridos en
 * el día) — si se repite, numera el viaje para distinguirlas; si no, deja
 * solo "Unidad N". `filasFinca` debe venir en el mismo orden en que se
 * planificaron (por `created_at`, que es el orden que ya trae el hook). */
export function etiquetaUnidad(filasFinca: TransporteUnidad[], fila: TransporteUnidad): string {
  const mismaUnidad = filasFinca.filter((f) => f.numero_unidad === fila.numero_unidad)
  if (mismaUnidad.length <= 1) return `Unidad ${fila.numero_unidad}`
  const indice = mismaUnidad.findIndex((f) => f.id === fila.id)
  return `Unidad ${fila.numero_unidad} (viaje ${indice + 1})`
}

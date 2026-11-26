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
  observaciones: string | null
  created_at: string
}

export type TransporteUnidadPlanInput = Pick<TransporteUnidad, 'finca' | 'fecha' | 'numero_unidad' | 'tipo' | 'cantidad_pallets'>

export type EstadoTransporte = 'pendiente' | 'llego' | 'completo'

/** Rojo (pendiente) mientras no se sepa el tipo o no se haya registrado la
 * hora de llegada/entrada; amarillo (llegó) una vez se registra esa hora
 * pero todavía falta la de salida; verde (completo) solo cuando ya no
 * queda nada pendiente por registrar — llegada y salida, las dos. */
export function estadoTransporte(u: TransporteUnidad): EstadoTransporte {
  if (u.tipo === null || u.hora_llegada === null) return 'pendiente'
  if (u.hora_salida === null) return 'llego'
  return 'completo'
}

/** Tipo + cuántos pallets carga (p. ej. "CAMIÓN POR 10"), sin mencionar el
 * número de unidad — de un vistazo entre los chips/botones rojos y verdes
 * se sabe cuál es el que falta por registrar y cuánta fruta va a llevar,
 * sin tener que pasar el mouse. El número de unidad (y, si esa misma unidad
 * se repite ese día, el número de viaje) queda solo en el `title` de cada
 * chip/botón, para quien sí lo necesite ver. */
export function etiquetaUnidad(fila: TransporteUnidad): string {
  const tipoTexto = fila.tipo === 'Camión' ? 'CAMIÓN' : fila.tipo === 'Contenedor' ? 'CONTENEDOR' : 'SIN TIPO'
  return fila.cantidad_pallets != null ? `${tipoTexto} POR ${fila.cantidad_pallets}` : tipoTexto
}

/** Para el `title` de cada chip/botón: número de unidad y, si esa unidad se
 * repite ese día en la misma finca (varios recorridos), de cuál viaje se
 * trata. `filasFinca` debe venir en el mismo orden en que se planificaron
 * (por `created_at`, que es el orden que ya trae el hook). */
export function detalleUnidad(filasFinca: TransporteUnidad[], fila: TransporteUnidad): string {
  const mismaUnidad = filasFinca.filter((f) => f.numero_unidad === fila.numero_unidad)
  if (mismaUnidad.length <= 1) return `Unidad ${fila.numero_unidad}`
  const indice = mismaUnidad.findIndex((f) => f.id === fila.id)
  return `Unidad ${fila.numero_unidad} (viaje ${indice + 1})`
}

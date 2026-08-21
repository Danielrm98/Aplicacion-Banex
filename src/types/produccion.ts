export interface Referencia {
  marca: string
  cajas_pallet: number
  factor_conversion: number
  tipo_caja: 'Convencional' | 'Orgánica'
  especificacion: 'Corta' | 'Larga'
  peso_neto_kg: number
}

export interface ProduccionItem {
  id: string
  produccion_id: string
  referencia: string
  cantidad_cajas: number
  peso_neto_kg: number
  cajas_20kg: number
  cajas_rechazadas: number
  motivo_rechazo: string | null
  created_at: string
}

export interface Transporte {
  id: string
  produccion_id: string
  tipo: 'Contenedor' | 'Camión'
  hora_llegada: string | null
  hora_salida: string | null
  placa: string | null
  sello: string | null
  created_at: string
}

export const TIPOS_TRANSPORTE = ['Contenedor', 'Camión'] as const

export const SEMANAS_RACIMO = [7, 8, 9, 10, 11, 12] as const

export const CAJA_20KG_KG = 18.5
export const CANASTILLA_KG = 19

export interface Produccion {
  id: string
  user_id: string
  fecha: string
  hora_finalizacion: string | null
  semana: number
  finca: string
  area_recorrida: number | null
  racimos_semana_7: number
  racimos_semana_8: number
  racimos_semana_9: number
  racimos_semana_10: number
  racimos_semana_11: number
  racimos_semana_12: number
  grado_semana_7: number | null
  grado_semana_8: number | null
  grado_semana_9: number | null
  grado_semana_10: number | null
  grado_semana_11: number | null
  grado_semana_12: number | null
  racimos_recusados: number
  canastillas: number
  notas: string | null
  created_at: string
  items: ProduccionItem[]
  transportes: Transporte[]
}

export type ProduccionItemInput = Omit<ProduccionItem, 'id' | 'produccion_id' | 'created_at'>
export type TransporteInput = Omit<Transporte, 'id' | 'produccion_id' | 'created_at'>
export type ProduccionHeaderInput = Pick<
  Produccion,
  | 'fecha'
  | 'hora_finalizacion'
  | 'semana'
  | 'finca'
  | 'area_recorrida'
  | 'racimos_semana_7'
  | 'racimos_semana_8'
  | 'racimos_semana_9'
  | 'racimos_semana_10'
  | 'racimos_semana_11'
  | 'racimos_semana_12'
  | 'grado_semana_7'
  | 'grado_semana_8'
  | 'grado_semana_9'
  | 'grado_semana_10'
  | 'grado_semana_11'
  | 'grado_semana_12'
  | 'racimos_recusados'
  | 'canastillas'
  | 'notas'
>

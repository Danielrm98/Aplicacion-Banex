import { sumarSemanas, type SemanaReal } from './anioEmbolses'

// Ciclo de color de cinta de embolse: 8 colores que se repiten en este
// orden exacto (confirmado con BANEX), sin reiniciarse nunca entre años —
// la semana ISO 42 del 2025 es CAFE (índice 3) y de ahí se cuenta siempre
// hacia adelante o hacia atrás en semanas reales, nunca "semana del año".
export const COLORES_CINTA = ['BLANCA', 'AZUL', 'ROJA', 'CAFE', 'NEGRA', 'NARANJA', 'VERDE', 'AMARILLA'] as const

export type ColorCinta = (typeof COLORES_CINTA)[number]

const ANCLA_ANIO = 2025
const ANCLA_SEMANA = 42
const ANCLA_INDICE = COLORES_CINTA.indexOf('CAFE')

export const ESTILO_CINTA: Record<ColorCinta, { bg: string; texto: string }> = {
  BLANCA: { bg: '#ffffff', texto: '#111827' },
  AZUL: { bg: '#2563eb', texto: '#ffffff' },
  ROJA: { bg: '#dc2626', texto: '#ffffff' },
  CAFE: { bg: '#7c4a1e', texto: '#ffffff' },
  NEGRA: { bg: '#111827', texto: '#ffffff' },
  NARANJA: { bg: '#f97316', texto: '#111827' },
  VERDE: { bg: '#16a34a', texto: '#ffffff' },
  AMARILLA: { bg: '#facc15', texto: '#111827' },
}

/** Lunes (en UTC, para no depender de la zona horaria del navegador) de una semana ISO. */
export function lunesDeSemanaIso(anio: number, semana: number): Date {
  const cuatroDeEnero = new Date(Date.UTC(anio, 0, 4))
  const diaIso = (cuatroDeEnero.getUTCDay() + 6) % 7 // 0 = lunes
  const lunesSemana1 = new Date(cuatroDeEnero)
  lunesSemana1.setUTCDate(cuatroDeEnero.getUTCDate() - diaIso)
  const resultado = new Date(lunesSemana1)
  resultado.setUTCDate(lunesSemana1.getUTCDate() + (semana - 1) * 7)
  return resultado
}

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000

export function colorCintaDe(anio: number, semana: number): ColorCinta {
  const diffSemanas = Math.round(
    (lunesDeSemanaIso(anio, semana).getTime() - lunesDeSemanaIso(ANCLA_ANIO, ANCLA_SEMANA).getTime()) / MS_POR_SEMANA,
  )
  const indice = (((ANCLA_INDICE + diffSemanas) % 8) + 8) % 8
  return COLORES_CINTA[indice]
}

/**
 * A qué semana de embolse (año/semana reales, mismas que usa la tabla
 * embolses) corresponde un racimo de cierta edad en semanas, reportado en
 * una semana dada. Edad 0 a 12, igual a como BANEX ya lo cuenta en sus
 * propias planillas de repique. Igual que en Registro de embolse (donde el
 * embolse de la semana N se registra con la cinta de la semana N+1), aquí
 * edad 0 (recién embolsado) usa la cinta de la semana SIGUIENTE a la que se
 * está reportando — confirmado cruzando los colores reales contra una
 * planilla de BANEX de varias semanas distintas.
 */
export function semanaEmbolseDeEdad(anioReporte: number, semanaReporte: number, edadSemanas: number): SemanaReal {
  return sumarSemanas(anioReporte, semanaReporte + 1, -edadSemanas)
}

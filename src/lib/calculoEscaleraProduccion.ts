// Fórmulas de la "escalera de producción": a partir del embolse semanal de
// una finca, proyecta en qué semana se va a cosechar y cuántos racimos va a
// rendir. Replica la lógica de la escalera en Excel (promedio estacional de
// embolse + distribución real por edad de cosecha), pero calculada sobre
// TODO el historial disponible en vez de copiar desplazamientos de fila
// fijos — así funciona igual de bien con poco historial (recién importado)
// que con mucho (a medida que la app acumula sus propias semanas).
import { sumarSemanas, type SemanaReal } from './anioEmbolses'
import { EDADES_COSECHA, type EdadCosecha } from '../types/escaleraProduccion'

export interface PuntoSerie {
  anio: number
  semana: number
  valor: number
}

export type DistribucionEdad = Record<EdadCosecha, number>

// Curva de respaldo (suma 1) mientras una finca todavía no tiene ninguna
// semana de "cosecha por edad" cargada — centrada en 11 semanas, que es lo
// que se observa en el histórico del Excel para varias fincas.
const DISTRIBUCION_RESPALDO: DistribucionEdad = { 8: 0, 9: 0.05, 10: 0.25, 11: 0.4, 12: 0.25, 13: 0.05 }

function claveSemana(anio: number, semana: number): number {
  return anio * 100 + semana
}

function promedioReciente(serie: PuntoSerie[], claveObjetivo: number, ventana: number): number | null {
  const anteriores = serie
    .filter((p) => claveSemana(p.anio, p.semana) < claveObjetivo)
    .sort((a, b) => claveSemana(b.anio, b.semana) - claveSemana(a.anio, a.semana))
    .slice(0, ventana)
  if (anteriores.length === 0) return null
  return anteriores.reduce((suma, p) => suma + p.valor, 0) / anteriores.length
}

/** Promedio de la misma semana ISO (+/-1, para suavizar) en años anteriores al objetivo. */
function promedioEstacional(serie: PuntoSerie[], anioObjetivo: number, semanaObjetivo: number, maxAnios: number): number | null {
  const porAnio = new Map<number, PuntoSerie>()
  for (const p of serie) {
    if (p.anio >= anioObjetivo) continue
    if (Math.abs(p.semana - semanaObjetivo) > 1) continue
    const actual = porAnio.get(p.anio)
    if (!actual || Math.abs(p.semana - semanaObjetivo) < Math.abs(actual.semana - semanaObjetivo)) porAnio.set(p.anio, p)
  }
  const elegidos = [...porAnio.values()].sort((a, b) => b.anio - a.anio).slice(0, maxAnios)
  if (elegidos.length === 0) return null
  return elegidos.reduce((suma, p) => suma + p.valor, 0) / elegidos.length
}

/**
 * Proyecta el valor esperado de una semana futura a partir de una serie
 * histórica: 80% nivel reciente (últimas `ventanaReciente` semanas con dato)
 * + 20% promedio estacional (misma semana ISO, hasta `maxAnios` años atrás).
 * Si solo hay uno de los dos componentes, usa ese solo.
 */
export function proyectarValorEstacional(
  serie: PuntoSerie[],
  anio: number,
  semana: number,
  opciones?: { pesoReciente?: number; ventanaReciente?: number; maxAnios?: number },
): number {
  const pesoReciente = opciones?.pesoReciente ?? 0.8
  const ventanaReciente = opciones?.ventanaReciente ?? 6
  const maxAnios = opciones?.maxAnios ?? 9
  const claveObjetivo = claveSemana(anio, semana)
  const reciente = promedioReciente(serie, claveObjetivo, ventanaReciente)
  const estacional = promedioEstacional(serie, anio, semana, maxAnios)
  if (reciente === null && estacional === null) return 0
  if (reciente === null) return estacional as number
  if (estacional === null) return reciente
  return reciente * pesoReciente + estacional * (1 - pesoReciente)
}

/** % de racimos cosechados a cada edad (8 a 13 semanas), promediado sobre
 * todo lo cargado para la finca. Mientras no haya historial, usa la curva
 * de respaldo centrada en 11 semanas. */
export function calcularDistribucionEdad(filas: { edad_semanas: number; racimos: number }[]): DistribucionEdad {
  const total = filas.reduce((suma, f) => suma + f.racimos, 0)
  if (total <= 0) return DISTRIBUCION_RESPALDO
  const porEdad = new Map<number, number>()
  for (const f of filas) porEdad.set(f.edad_semanas, (porEdad.get(f.edad_semanas) ?? 0) + f.racimos)
  const resultado = {} as DistribucionEdad
  for (const edad of EDADES_COSECHA) resultado[edad] = (porEdad.get(edad) ?? 0) / total
  return resultado
}

/** Edad promedio (en semanas) que implica una distribución — para ubicar en qué semana cae el grueso de la cosecha de un embolse. */
export function edadPromedio(distribucion: DistribucionEdad): number {
  const total = EDADES_COSECHA.reduce((suma, e) => suma + distribucion[e], 0)
  if (total <= 0) return 11
  return EDADES_COSECHA.reduce((suma, e) => suma + e * distribucion[e], 0) / total
}

/** Recobro: fracción del embolse que efectivamente se cosecha entre las semanas 8 y 13 de edad (el resto se repica o se pierde). */
export function calcularRecobro(distribucion: DistribucionEdad): number {
  return EDADES_COSECHA.reduce((suma, e) => suma + distribucion[e], 0)
}

export interface FilaEscalera {
  anioEmbolse: number
  semanaEmbolse: number
  hectareas: number | null
  bellPorHa: number
  embolseReal: number
  esEmbolseReal: boolean
  anioCosecha: number
  semanaCosecha: number
  racimosCosechados: number
  recobro: number
  esCosechaReal: boolean
}

/**
 * Arma una fila de la escalera para una semana de embolse: si ya hay
 * embolse real para esa semana lo usa tal cual; si no, lo proyecta con
 * `proyectarValorEstacional` sobre la serie de Bell/ha histórica.
 */
export function calcularFilaEscalera(params: {
  anioEmbolse: number
  semanaEmbolse: number
  hectareas: number | null
  embolseRealDeEstaSemana: number | null
  serieBellPorHa: PuntoSerie[]
  distribucionEdad: DistribucionEdad
  semanaCosechaYaOcurrida: (semana: SemanaReal) => boolean
}): FilaEscalera {
  const { anioEmbolse, semanaEmbolse, hectareas, embolseRealDeEstaSemana, serieBellPorHa, distribucionEdad, semanaCosechaYaOcurrida } = params

  const esEmbolseReal = embolseRealDeEstaSemana !== null
  const bellPorHa = esEmbolseReal && hectareas ? embolseRealDeEstaSemana! / hectareas : proyectarValorEstacional(serieBellPorHa, anioEmbolse, semanaEmbolse)
  const embolseReal = esEmbolseReal ? embolseRealDeEstaSemana! : bellPorHa * (hectareas ?? 0)

  const recobro = calcularRecobro(distribucionEdad)
  const racimosCosechados = embolseReal * recobro

  const desplazamiento = Math.round(edadPromedio(distribucionEdad))
  const { anio: anioCosecha, semana: semanaCosecha } = sumarSemanas(anioEmbolse, semanaEmbolse, desplazamiento)

  return {
    anioEmbolse,
    semanaEmbolse,
    hectareas,
    bellPorHa,
    embolseReal,
    esEmbolseReal,
    anioCosecha,
    semanaCosecha,
    racimosCosechados,
    recobro,
    esCosechaReal: semanaCosechaYaOcurrida({ anio: anioCosecha, semana: semanaCosecha }),
  }
}

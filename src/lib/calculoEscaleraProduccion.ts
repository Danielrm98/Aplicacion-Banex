// Fórmulas de la "escalera de producción": a partir del embolse semanal de
// una finca, proyecta en qué semana se va a cosechar y cuántos racimos va a
// rendir. Replica la lógica de la escalera en Excel:
//   - El embolse futuro se proyecta con un promedio estacional (80% nivel
//     reciente + 20% misma época en años anteriores) calculado sobre TODO
//     el historial disponible, no desplazamientos de fila fijos — así
//     funciona igual de bien con poco historial que con mucho.
//   - Cada edad (8 a 13 semanas) de un cohorte de embolse cae en una
//     semana de cosecha distinta (semana de embolse + esa edad). Si ya
//     hay un dato real cargado en "Registro semanal" para esa semana de
//     cosecha y esa edad, se usa tal cual (igual que las fórmulas
//     diagonales %8.."%13" del Excel, que miran hacia adelante en la
//     propia hoja); si no, se proyecta con el promedio histórico de la
//     finca para esa edad.
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
const DISTRIBUCION_RESPALDO: DistribucionEdad = { 7: 0, 8: 0, 9: 0.05, 10: 0.25, 11: 0.4, 12: 0.25, 13: 0.05 }

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
 * de respaldo centrada en 11 semanas. Sirve para proyectar lo que todavía
 * no tiene dato real cargado (semanas futuras, o pasadas sin digitar). */
export function calcularDistribucionRespaldo(filas: { edad_semanas: number; racimos: number }[]): DistribucionEdad {
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

export interface DesgloseEdad {
  edad: EdadCosecha
  anioCosecha: number
  semanaCosecha: number
  racimos: number
  porcentaje: number
  esReal: boolean
}

export interface FilaEscalera {
  anioEmbolse: number
  semanaEmbolse: number
  hectareas: number | null
  bellPorHa: number
  embolseReal: number
  esEmbolseReal: boolean
  anioCosechaPrincipal: number
  semanaCosechaPrincipal: number
  racimosCosechados: number
  repicado: number
  porcentajeRepique: number
  recobro: number
  edadPromReal: number
  desglose: DesgloseEdad[]
  esFilaReal: boolean
}

/**
 * Arma una fila de la escalera para una semana de embolse. El embolse usa
 * el dato real si ya existe, o se proyecta con `proyectarValorEstacional`.
 * Cada una de las 7 edades (7-13) cae en su propia semana de cosecha
 * (embolse + edad): si ya hay un dato real (formulario diario de Registrar,
 * o la semilla histórica) se usa tal cual; si no, se proyecta con
 * `distribucionProyeccion` — el % real de racimos por edad (y por lo tanto
 * el recobro) de la última cohorte de embolse ya completa, "lo que quedó
 * la semana anterior" (no un promedio de todo el histórico, para que la
 * proyección responda al desempeño actual). El Recobro final de cada fila
 * es siempre (racimos cosechados + repicado real) ÷ embolsado — misma
 * fórmula que ya usa la página Recobro.
 */
export function calcularFilaEscalera(params: {
  anioEmbolse: number
  semanaEmbolse: number
  hectareas: number | null
  embolseRealDeEstaSemana: number | null
  serieBellPorHa: PuntoSerie[]
  distribucionProyeccion: DistribucionEdad
  racimosRealesDeEdad: (anio: number, semana: number, edad: EdadCosecha) => number | undefined
  repicadoReal: (anio: number, semana: number) => number | undefined
  semanaYaOcurrida: (semana: SemanaReal) => boolean
}): FilaEscalera {
  const {
    anioEmbolse,
    semanaEmbolse,
    hectareas,
    embolseRealDeEstaSemana,
    serieBellPorHa,
    distribucionProyeccion,
    racimosRealesDeEdad,
    repicadoReal,
    semanaYaOcurrida,
  } = params

  const esEmbolseReal = embolseRealDeEstaSemana !== null
  const bellPorHa =
    esEmbolseReal && hectareas ? embolseRealDeEstaSemana! / hectareas : proyectarValorEstacional(serieBellPorHa, anioEmbolse, semanaEmbolse)
  const embolseReal = esEmbolseReal ? embolseRealDeEstaSemana! : bellPorHa * (hectareas ?? 0)

  const desglose: DesgloseEdad[] = EDADES_COSECHA.map((edad) => {
    const { anio: anioCosecha, semana: semanaCosecha } = sumarSemanas(anioEmbolse, semanaEmbolse, edad)
    // OJO: la búsqueda del dato real es por semana de EMBOLSE (no de
    // cosecha) — así quedan indexados tanto el dato en vivo como el
    // histórico en useEscaleraProduccion.
    const real = racimosRealesDeEdad(anioEmbolse, semanaEmbolse, edad)
    const esReal = real !== undefined
    // distribucionProyeccion ya es el % real de embolsado (no normalizado a
    // sumar 1): embolseReal × esa fracción da directamente el racimo
    // proyectado para esa edad, con el mismo nivel y forma de la última
    // semana real completa.
    const racimos = esReal ? (real as number) : embolseReal * distribucionProyeccion[edad]
    return {
      edad,
      anioCosecha,
      semanaCosecha,
      racimos,
      porcentaje: embolseReal > 0 ? racimos / embolseReal : 0,
      esReal,
    }
  })

  const racimosCosechados = desglose.reduce((suma, d) => suma + d.racimos, 0)
  const repicado = repicadoReal(anioEmbolse, semanaEmbolse) ?? 0
  const recobro = embolseReal > 0 ? (racimosCosechados + repicado) / embolseReal : 0
  const porcentajeRepique = embolseReal > 0 ? repicado / embolseReal : 0

  // Edad promedio REAL de esta cohorte (no la de la distribución de
  // respaldo): peso cada edad por sus propios racimos, reales o
  // proyectados — a diferencia del "desplazamiento" de abajo (que es fijo
  // por finca, para ubicar la semana de cosecha "principal" de forma
  // estable), esta sí varía cohorte a cohorte.
  const edadPromReal = racimosCosechados > 0 ? desglose.reduce((suma, d) => suma + d.edad * d.racimos, 0) / racimosCosechados : 0

  const desplazamiento = Math.round(edadPromedio(distribucionProyeccion))
  const { anio: anioCosechaPrincipal, semana: semanaCosechaPrincipal } = sumarSemanas(anioEmbolse, semanaEmbolse, desplazamiento)

  return {
    anioEmbolse,
    semanaEmbolse,
    hectareas,
    bellPorHa,
    embolseReal,
    esEmbolseReal,
    anioCosechaPrincipal,
    semanaCosechaPrincipal,
    racimosCosechados,
    repicado,
    porcentajeRepique,
    recobro,
    edadPromReal,
    desglose,
    esFilaReal: semanaYaOcurrida({ anio: anioCosechaPrincipal, semana: semanaCosechaPrincipal }),
  }
}

// Fórmulas de la "escalera de producción": a partir del embolse semanal de
// una finca, proyecta en qué semana se va a cosechar y cuántos racimos va a
// rendir. Replica la lógica de la escalera en Excel:
//   - El embolse futuro se proyecta con un promedio estacional (80% nivel
//     reciente + 20% misma época en años anteriores) calculado sobre TODO
//     el historial disponible, no desplazamientos de fila fijos — así
//     funciona igual de bien con poco historial que con mucho.
//   - Cada edad (8 a 12 semanas — se descartan la 7 y la 13 por poco
//     confiables) de un cohorte de embolse cae en una semana de cosecha
//     distinta (semana de embolse + esa edad). Si ya hay un dato real del
//     formulario diario de Registrar para esa semana de cosecha y esa
//     edad, se usa tal cual (igual que las fórmulas diagonales del Excel,
//     que miran hacia adelante en la propia hoja); si no, se proyecta con
//     el recobro y la forma de la última cohorte completa.
import { sumarSemanas, type SemanaReal } from './anioEmbolses'
import { EDADES_COSECHA, type EdadCosecha } from '../types/escaleraProduccion'

export interface PuntoSerie {
  anio: number
  semana: number
  valor: number
}

export type DistribucionEdad = Record<EdadCosecha, number>

// Curva de respaldo (suma 1) mientras una finca todavía no tiene ninguna
// semana de "cosecha por edad" cargada — centrada en 10-11 semanas, que es
// lo que se observa en el histórico del Excel para varias fincas.
const DISTRIBUCION_RESPALDO: DistribucionEdad = { 8: 0.05, 9: 0.25, 10: 0.4, 11: 0.25, 12: 0.05 }

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

/** % de racimos cosechados a cada edad (8 a 12 semanas), promediado sobre
 * todo lo cargado para la finca. Ignora cualquier fila de otra edad (7, 13)
 * que pueda traer el histórico importado, tanto para la forma como para el
 * total. Mientras no haya historial, usa la curva de respaldo centrada en
 * 10-11 semanas. Sirve para proyectar lo que todavía no tiene dato real
 * cargado (semanas futuras, o pasadas sin digitar). */
export function calcularDistribucionRespaldo(filas: { edad_semanas: number; racimos: number }[]): DistribucionEdad {
  const filasValidas = filas.filter((f): f is { edad_semanas: EdadCosecha; racimos: number } =>
    (EDADES_COSECHA as readonly number[]).includes(f.edad_semanas),
  )
  const total = filasValidas.reduce((suma, f) => suma + f.racimos, 0)
  if (total <= 0) return DISTRIBUCION_RESPALDO
  const porEdad = new Map<number, number>()
  for (const f of filasValidas) porEdad.set(f.edad_semanas, (porEdad.get(f.edad_semanas) ?? 0) + f.racimos)
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
 *
 * Las edades (8-12) NO se proyectan cada una por separado: un racimo
 * embolsado siempre se reporta cosechado dentro de las 12 semanas (lo que
 * no se reporta es una novedad interna puntual, no la norma), así que el
 * recobro de una fila siempre tiende a `recobroObjetivo` (97-98%, igual
 * que en el Excel, que calcula el % de la última edad como lo que falta
 * para llegar a un recobro fijo, no como un valor independiente). Por eso
 * aquí: lo que YA es real (formulario diario de Registrar, o la semilla
 * histórica) se deja tal cual, nunca se toca; lo que falta se reparte
 * entre las edades todavía sin dato, según la FORMA de `distribucionProyeccion`
 * (de dónde pesan más las edades recientes — su escala absoluta no
 * importa, solo la proporción relativa entre las edades pendientes), de
 * modo que el total de la fila (reales + repartido) cierre en
 * `recobroObjetivo`. Si una fila ya está completamente real, su recobro es
 * el que sea — nunca se fuerza al objetivo.
 *
 * Excepción: si `distribucionProyeccion` viene de un modelo MANUAL (el
 * administrador la modeló a mano, pestaña "Modelo de cajas"), se respeta
 * literalmente edad por edad (racimos = embolsado × %), sin reajustarla al
 * objetivo — ahí el administrador quiere control total de cada %, igual
 * que en la vista previa de esa pestaña, no que la app reescale lo que
 * escribió.
 */
export function calcularFilaEscalera(params: {
  anioEmbolse: number
  semanaEmbolse: number
  hectareas: number | null
  embolseRealDeEstaSemana: number | null
  serieBellPorHa: PuntoSerie[]
  distribucionProyeccion: DistribucionEdad
  distribucionEsManual: boolean
  recobroObjetivo: number
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
    distribucionEsManual,
    recobroObjetivo,
    racimosRealesDeEdad,
    repicadoReal,
    semanaYaOcurrida,
  } = params

  const esEmbolseReal = embolseRealDeEstaSemana !== null
  const bellPorHa =
    esEmbolseReal && hectareas ? embolseRealDeEstaSemana! / hectareas : proyectarValorEstacional(serieBellPorHa, anioEmbolse, semanaEmbolse)
  const embolseReal = esEmbolseReal ? embolseRealDeEstaSemana! : bellPorHa * (hectareas ?? 0)

  // 1. Qué edades ya son reales, y el repique real (si ya se sabe).
  const parcial = EDADES_COSECHA.map((edad) => ({
    edad,
    real: racimosRealesDeEdad(anioEmbolse, semanaEmbolse, edad),
  }))
  const repicadoRealValor = repicadoReal(anioEmbolse, semanaEmbolse)
  const repicado = repicadoRealValor ?? 0

  // 2. Cuánto del objetivo ya está cubierto por datos reales, y cuánto
  // queda por repartir entre las edades todavía sin reportar.
  const porcentajeRealConocido =
    embolseReal > 0
      ? parcial.reduce((suma, p) => suma + (p.real !== undefined ? p.real / embolseReal : 0), 0) +
        (repicadoRealValor !== undefined ? repicadoRealValor / embolseReal : 0)
      : 0
  const edadesPendientes = parcial.filter((p) => p.real === undefined).map((p) => p.edad)
  const presupuestoPendiente = Math.max(0, recobroObjetivo - porcentajeRealConocido)
  const pesoPendientes = edadesPendientes.reduce((suma, edad) => suma + distribucionProyeccion[edad], 0)

  const desglose: DesgloseEdad[] = parcial.map(({ edad, real }) => {
    // Semana de cosecha que se MUESTRA para esta edad (solo referencia —
    // la búsqueda del dato real de arriba no depende de este cálculo). Se
    // usa "embolse + edad" tal cual, igual que Año Cos/Sem Cos en el Excel
    // (Año Emb + edad promedio, sin restar nada).
    const { anio: anioCosecha, semana: semanaCosecha } = sumarSemanas(anioEmbolse, semanaEmbolse, edad)
    const esReal = real !== undefined
    let racimos: number
    if (esReal) {
      racimos = real as number
    } else if (distribucionEsManual) {
      racimos = embolseReal * distribucionProyeccion[edad]
    } else if (pesoPendientes > 0) {
      racimos = embolseReal * presupuestoPendiente * (distribucionProyeccion[edad] / pesoPendientes)
    } else {
      // Ninguna de las edades pendientes tiene peso en la forma reciente
      // (caso raro): se reparte el presupuesto en partes iguales entre ellas.
      racimos = edadesPendientes.length > 0 ? (embolseReal * presupuestoPendiente) / edadesPendientes.length : 0
    }
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

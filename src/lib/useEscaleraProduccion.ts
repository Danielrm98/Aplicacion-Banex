import { useMemo } from 'react'
import { useEmbolses } from './useEmbolses'
import { useEmbolseHistorico } from './useEmbolseHistorico'
import { useCosechaPorEdad } from './useCosechaPorEdad'
import { useRacimosPorEdadReal } from './useRacimosPorEdadReal'
import { useModeloEdad } from './useModeloEdad'
import { useMetricasProduccionPorSemana } from './useMetricasProduccionPorSemana'
import { useRepiques } from './useRepiques'
import { useLotes } from './useLotes'
import { getIsoWeek, getIsoYear } from './isoWeek'
import { fechaLocalHoy } from './fechaLocal'
import { sumarSemanas } from './anioEmbolses'
import {
  calcularDistribucionRespaldo,
  calcularFilaEscalera,
  type DistribucionEdad,
  type PuntoSerie,
  type FilaEscalera,
} from './calculoEscaleraProduccion'
import { EDADES_COSECHA, type EdadCosecha } from '../types/escaleraProduccion'
import type { Finca } from '../types/finca'

const SEMANAS_ATRAS = 13
const SEMANAS_ADELANTE = 13
// Cuánto hacia atrás se busca cohortes de embolse ya completas (con las 5
// edades, 8-12, ya cosechadas) para promediar su recobro y su % por edad
// reales como base de la proyección.
const SEMANAS_BUSQUEDA_RECOBRO = 40
// Cuántas de esas cohortes completas, las más recientes, se promedian —
// una sola semana puede ser atípica (una lluvia, un corte flojo); 2
// suaviza eso sin diluirse en un promedio de todo el histórico.
const COHORTES_PARA_PROMEDIO = 2
// Objetivo de recobro al que SIEMPRE cierra una fila que todavía tiene
// edades sin reportar: un racimo embolsado SIEMPRE se tiene que reportar
// cosechado dentro de las 12 semanas (lo que no se reporta en ese plazo es
// por una novedad interna puntual de la finca, no la norma), así que el
// margen normal de recobro es 97-98%. Igual que en el Excel: no se proyecta
// cada edad por separado, se fija este total y lo que falta por cosechar
// se reparte entre las edades aún sin dato para completarlo. Esto NO afecta
// a lo que ya es real (una edad ya cosechada muestra su dato real, sea el
// que sea, nunca se ajusta).
const RECOBRO_OBJETIVO = 0.975

/** Arma la escalera de producción de una finca: semana de embolse → semana
 * de cosecha, con lo real ya cargado (embolses de la app + semilla
 * histórica importada + racimos por edad del formulario diario de
 * Registrar + repique real) y lo futuro proyectado. La proyección de
 * racimos cosechados usa el Recobro real de la última cohorte de embolse
 * ya completa ("lo que quedó la semana anterior"), no un promedio de todo
 * el histórico — igual que el ratio cajas/racimo (ver useRacimosPorEdadReal).
 * Ventana fija de 13 semanas atrás y 13 adelante. Solo se cuentan las
 * edades 8 a 12 (se descartan la 7 y la 13, poco confiables). También
 * devuelve la serie completa de Bell/Ha para el gráfico comparativo. */
export function useEscaleraProduccion(finca: Finca | null) {
  const nombreFinca = finca?.nombre ?? null
  const anioActual = getIsoYear(fechaLocalHoy())
  const semanaActual = getIsoWeek(fechaLocalHoy())

  const inicio = sumarSemanas(anioActual, semanaActual, -SEMANAS_ATRAS)
  const fin = sumarSemanas(anioActual, semanaActual, SEMANAS_ADELANTE)
  const aniosNecesarios = useMemo(() => {
    const anios = new Set<number>()
    for (let a = inicio.anio; a <= fin.anio; a++) anios.add(a)
    return [...anios]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio.anio, fin.anio])

  const { embolses, loading: loadingEmbolses } = useEmbolses({ anios: aniosNecesarios })
  const { repiques, loading: loadingRepiques } = useRepiques({ anios: aniosNecesarios })
  const { lotes, loading: loadingLotes } = useLotes()
  const { filas: historico, loading: loadingHistorico } = useEmbolseHistorico(nombreFinca)
  const { filas: cosechaEdadHistorica, loading: loadingCosecha } = useCosechaPorEdad(nombreFinca)
  const {
    mapa: racimosEdadReal,
    ratioCajas20kgPorRacimo,
    ratioCajasFisicasPorRacimo,
    ratioCortaPorRacimo,
    ratioPremiumPorRacimo,
    loading: loadingProduccion,
  } = useRacimosPorEdadReal(nombreFinca)
  const { filas: modeloManual, loading: loadingModelo, refetch: refetchModelo } = useModeloEdad(nombreFinca)
  const { mapa: metricasPorSemana, loading: loadingMetricas } = useMetricasProduccionPorSemana(nombreFinca)

  const loading =
    loadingEmbolses ||
    loadingRepiques ||
    loadingLotes ||
    loadingHistorico ||
    loadingCosecha ||
    loadingProduccion ||
    loadingModelo ||
    loadingMetricas

  const lotesFinca = useMemo(() => {
    if (!finca) return new Set<string>()
    return new Set(lotes.filter((l) => l.finca === finca.nombre).map((l) => l.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, lotes])

  const embolseRealPorSemana = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of embolses) {
      if (!lotesFinca.has(e.lote_id)) continue
      const clave = `${e.anio}_${e.semana}`
      mapa.set(clave, (mapa.get(clave) ?? 0) + e.cantidad)
    }
    return mapa
  }, [lotesFinca, embolses])

  // Repicado real, atribuido a su semana de embolse — mismo criterio que
  // usa la página Recobro (Repicado cuenta como parte de lo recuperado,
  // junto con lo cosechado).
  const repicadoPorSemanaEmbolse = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of repiques) {
      if (!lotesFinca.has(r.lote_id)) continue
      const clave = `${r.anio_embolse}_${r.semana_embolse}`
      mapa.set(clave, (mapa.get(clave) ?? 0) + r.cantidad)
    }
    return mapa
  }, [lotesFinca, repiques])

  // Serie completa de Bell/Ha (todo el historial, no solo la ventana) —
  // la usa la proyección estacional de embolse y el gráfico comparativo.
  const serieBellPorHa = useMemo<PuntoSerie[]>(() => {
    if (!finca) return []
    const serie: PuntoSerie[] = []
    for (const h of historico) {
      if (h.bell_por_ha != null) serie.push({ anio: h.anio, semana: h.semana, valor: h.bell_por_ha })
    }
    if (finca.hectareas) {
      for (const [clave, cantidad] of embolseRealPorSemana) {
        const [anioStr, semanaStr] = clave.split('_')
        serie.push({ anio: Number(anioStr), semana: Number(semanaStr), valor: cantidad / finca.hectareas })
      }
    }
    return serie
  }, [finca, historico, embolseRealPorSemana])

  // El histórico importado del Excel queda indexado por semana de COSECHA
  // (así venía en el Excel); aquí se reindexa por semana de EMBOLSE
  // (cosecha - edad) para que use la misma llave que el dato en vivo.
  const racimosEdadHistorico = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const f of cosechaEdadHistorica) {
      const { anio: anioEmb, semana: semEmb } = sumarSemanas(f.anio, f.semana, -f.edad_semanas)
      mapa.set(`${anioEmb}_${semEmb}_${f.edad_semanas}`, f.racimos)
    }
    return mapa
  }, [cosechaEdadHistorica])

  const racimosRealesDeEdadCrudo = useMemo(() => {
    return (anio: number, semana: number, edad: EdadCosecha) => {
      const clave = `${anio}_${semana}_${edad}`
      return racimosEdadReal.get(clave) ?? racimosEdadHistorico.get(clave)
    }
  }, [racimosEdadReal, racimosEdadHistorico])

  // Una edad solo cuenta como dato REAL si su semana de reporte
  // (semanaEmbolseDeEdad: embolse + edad - 1) ya pasó COMPLETA — no la
  // semana actual, que todavía se está llenando día a día en "Registrar".
  // Sin esto, una cohorte cuya última edad cae justo en la semana en curso
  // se tomaba como "real" con lo que llevaba digitado hasta ese momento
  // (un número parcial, de solo los días ya registrados), arrastrando el
  // recobro hacia abajo con un dato que ni siquiera había terminado de
  // cargarse.
  const racimosRealesDeEdad = useMemo(() => {
    return (anio: number, semana: number, edad: EdadCosecha) => {
      const { anio: anioReporte, semana: semanaReporte } = sumarSemanas(anio, semana, edad - 1)
      const yaPasoCompleta = anioReporte < anioActual || (anioReporte === anioActual && semanaReporte < semanaActual)
      if (!yaPasoCompleta) return undefined
      return racimosRealesDeEdadCrudo(anio, semana, edad)
    }
  }, [racimosRealesDeEdadCrudo, anioActual, semanaActual])

  const embolsadoDe = (anio: number, semana: number): number | null => {
    const real = embolseRealPorSemana.get(`${anio}_${semana}`)
    if (real !== undefined) return real
    const h = historico.find((x) => x.anio === anio && x.semana === semana)
    return h?.emb_real ?? null
  }

  // Se busca hacia atrás hasta encontrar las últimas `COHORTES_PARA_PROMEDIO`
  // cohortes de embolse ya completas (las 5 edades, 8-12, ya cosechadas —
  // no una a medias, que todavía podría subir) y se agrupan (no se
  // promedian sus % directamente: se suman sus racimos por edad y su
  // embolsado, y se divide, para que una semana con más volumen pese más)
  // para dar la FORMA (qué edades pesan más entre sí) que se usa para
  // repartir, en cada fila, lo que todavía falta por cosechar hasta llegar
  // a RECOBRO_OBJETIVO (ver calcularFilaEscalera) — el nivel final de cada
  // fila no lo pone esta forma, lo pone el objetivo fijo, igual que en el
  // Excel. Por eso esta distribución no necesita sumar nada en particular:
  // solo importa la proporción relativa entre edades.
  const modeloEsManual = modeloManual.length > 0

  const distribucionProyeccion = useMemo<DistribucionEdad>(() => {
    // Si el administrador ya modeló a mano el % por edad de esta finca, se
    // usa tal cual (como forma relativa) — tiene prioridad sobre el cálculo
    // automático.
    if (modeloManual.length > 0) {
      const resultado = {} as DistribucionEdad
      for (const edad of EDADES_COSECHA) resultado[edad] = 0
      for (const m of modeloManual) resultado[m.edad_semanas] = m.porcentaje / 100
      return resultado
    }

    // Empieza en HOY (no en hoy menos el máximo de semanas de edad): una
    // cohorte embolsada hace solo 10-11 semanas ya puede estar completa
    // (la edad se reporta a las edad-1 semanas, ver semanaEmbolseDeEdad en
    // cintaEmbolse.ts), así que empezar más atrás se saltaba cohortes más
    // recientes que ya estaban completas y terminaba usando una vieja.
    let cursor = { anio: anioActual, semana: semanaActual }
    const cohortes: { embolsado: number; racimosPorEdad: number[] }[] = []
    for (let i = 0; i < SEMANAS_BUSQUEDA_RECOBRO && cohortes.length < COHORTES_PARA_PROMEDIO; i++) {
      const embolsado = embolsadoDe(cursor.anio, cursor.semana)
      if (embolsado && embolsado > 0) {
        const racimosPorEdadCohorte = EDADES_COSECHA.map((edad) => racimosRealesDeEdad(cursor.anio, cursor.semana, edad))
        const todasReales = racimosPorEdadCohorte.every((v) => v !== undefined)
        if (todasReales) {
          cohortes.push({ embolsado, racimosPorEdad: racimosPorEdadCohorte.map((v) => v ?? 0) })
        }
      }
      cursor = sumarSemanas(cursor.anio, cursor.semana, -1)
    }

    if (cohortes.length > 0) {
      const totalEmbolsado = cohortes.reduce((suma, c) => suma + c.embolsado, 0)
      const totalPorEdad = EDADES_COSECHA.map((_, i) => cohortes.reduce((suma, c) => suma + c.racimosPorEdad[i], 0))
      const resultado = {} as DistribucionEdad
      EDADES_COSECHA.forEach((edad, i) => {
        resultado[edad] = totalPorEdad[i] / totalEmbolsado
      })
      return resultado
    }

    // Respaldo: forma del histórico importado (si lo hay); si tampoco hay
    // histórico, la curva fija.
    return calcularDistribucionRespaldo(cosechaEdadHistorica.map((f) => ({ edad_semanas: f.edad_semanas, racimos: f.racimos })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloManual, anioActual, semanaActual, embolseRealPorSemana, historico, racimosRealesDeEdad, cosechaEdadHistorica])

  const filas = useMemo<FilaEscalera[]>(() => {
    if (!finca) return []

    const semanaYaOcurrida = (semana: { anio: number; semana: number }) =>
      semana.anio < anioActual || (semana.anio === anioActual && semana.semana <= semanaActual)

    const repicadoReal = (anio: number, semana: number) => repicadoPorSemanaEmbolse.get(`${anio}_${semana}`)

    const resultado: FilaEscalera[] = []
    let cursor = inicio
    // Tope de seguridad (52+27) para no colgar la pestaña si algo deja el
    // bucle sin converger — nunca debería hacer falta con la ventana fija.
    for (let i = 0; i < SEMANAS_ATRAS + SEMANAS_ADELANTE + 5; i++) {
      if (cursor.anio > fin.anio || (cursor.anio === fin.anio && cursor.semana > fin.semana)) break

      resultado.push(
        calcularFilaEscalera({
          anioEmbolse: cursor.anio,
          semanaEmbolse: cursor.semana,
          hectareas: finca.hectareas,
          embolseRealDeEstaSemana: embolsadoDe(cursor.anio, cursor.semana),
          serieBellPorHa,
          distribucionProyeccion,
          distribucionEsManual: modeloEsManual,
          recobroObjetivo: RECOBRO_OBJETIVO,
          racimosRealesDeEdad,
          repicadoReal,
          semanaYaOcurrida,
        }),
      )
      cursor = sumarSemanas(cursor.anio, cursor.semana, 1)
    }
    return resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finca,
    distribucionProyeccion,
    modeloEsManual,
    racimosRealesDeEdad,
    repicadoPorSemanaEmbolse,
    embolseRealPorSemana,
    historico,
    serieBellPorHa,
    inicio.anio,
    inicio.semana,
    fin.anio,
    fin.semana,
    anioActual,
    semanaActual,
  ])

  return {
    filas,
    serieBellPorHa,
    ratioCajas20kgPorRacimo,
    ratioCajasFisicasPorRacimo,
    ratioCortaPorRacimo,
    ratioPremiumPorRacimo,
    metricasPorSemana,
    recobroObjetivo: RECOBRO_OBJETIVO,
    distribucionProyeccion,
    modeloEsManual,
    refetchModelo,
    loading,
    anioActual,
    semanaActual,
  }
}

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
// Piso del recobro proyectado: la proyección de la semana siguiente se usa
// para sacar los pedidos a las fincas (se hacen una semana antes), así que
// no puede salir por debajo de esto aunque el promedio reciente esté más
// bajo — es mejor pedir de más que quedarse corto. Esto NO afecta a lo que
// ya es real (una semana ya cosechada muestra su recobro real, sea el que
// sea, nunca se le aplica este piso).
const PISO_RECOBRO_PROYECTADO = 0.95
// Recobro de respaldo si todavía no hay ninguna cohorte completa (finca
// nueva, sin historial ni formulario diario cargado aún) — por debajo del
// piso de todas formas, así que en la práctica el piso es el que manda.
const RECOBRO_RESPALDO = 0.85

/** Si la distribución suma menos que `piso`, la reescala completa (sin
 * cambiar la forma entre edades) para que sume exactamente el piso. Se usa
 * solo en el cálculo automático; un modelo manual del administrador nunca
 * se toca, aunque esté por debajo del piso a propósito. */
function aplicarPisoRecobro(distribucion: DistribucionEdad, piso: number): DistribucionEdad {
  const suma = EDADES_COSECHA.reduce((s, edad) => s + distribucion[edad], 0)
  if (suma <= 0 || suma >= piso) return distribucion
  const factor = piso / suma
  const resultado = {} as DistribucionEdad
  for (const edad of EDADES_COSECHA) resultado[edad] = distribucion[edad] * factor
  return resultado
}

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

  const racimosRealesDeEdad = useMemo(() => {
    return (anio: number, semana: number, edad: EdadCosecha) => {
      const clave = `${anio}_${semana}_${edad}`
      return racimosEdadReal.get(clave) ?? racimosEdadHistorico.get(clave)
    }
  }, [racimosEdadReal, racimosEdadHistorico])

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
  // para dar el % real de racimos por edad que se usa como base de la
  // proyección — con un piso (PISO_RECOBRO_PROYECTADO): esta proyección
  // sirve para sacar los pedidos a las fincas una semana antes, así que no
  // puede salir más baja que eso. Tanto el nivel (recobro) como la forma
  // (qué edades pesan más) quedan parecidos al desempeño reciente, pero sin
  // que una sola semana atípica (una lluvia, un corte flojo) descalibre
  // toda la proyección hacia adelante.
  const modeloEsManual = modeloManual.length > 0

  const distribucionProyeccion = useMemo<DistribucionEdad>(() => {
    // Si el administrador ya modeló a mano el % por edad de esta finca, se
    // usa tal cual — tiene prioridad sobre el cálculo automático.
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
    const cohortes: { embolsado: number; racimosPorEdad: number[]; repicado: number }[] = []
    for (let i = 0; i < SEMANAS_BUSQUEDA_RECOBRO && cohortes.length < COHORTES_PARA_PROMEDIO; i++) {
      const embolsado = embolsadoDe(cursor.anio, cursor.semana)
      if (embolsado && embolsado > 0) {
        const racimosPorEdadCohorte = EDADES_COSECHA.map((edad) => racimosRealesDeEdad(cursor.anio, cursor.semana, edad))
        const todasReales = racimosPorEdadCohorte.every((v) => v !== undefined)
        if (todasReales) {
          cohortes.push({
            embolsado,
            racimosPorEdad: racimosPorEdadCohorte.map((v) => v ?? 0),
            repicado: repicadoPorSemanaEmbolse.get(`${cursor.anio}_${cursor.semana}`) ?? 0,
          })
        }
      }
      cursor = sumarSemanas(cursor.anio, cursor.semana, -1)
    }

    if (cohortes.length > 0) {
      const totalEmbolsado = cohortes.reduce((suma, c) => suma + c.embolsado, 0)
      const totalRepicado = cohortes.reduce((suma, c) => suma + c.repicado, 0)
      const totalPorEdad = EDADES_COSECHA.map((_, i) => cohortes.reduce((suma, c) => suma + c.racimosPorEdad[i], 0))
      const totalCosechado = totalPorEdad.reduce((suma, v) => suma + v, 0)
      // Factor para que la distribución, al sumarla, dé el recobro completo
      // (cosechado + repicado) y no solo lo cosechado — conserva la forma
      // real por edad, solo ajusta el nivel.
      const factorRepique = totalCosechado > 0 ? (totalCosechado + totalRepicado) / totalCosechado : 1
      const resultado = {} as DistribucionEdad
      EDADES_COSECHA.forEach((edad, i) => {
        resultado[edad] = (totalPorEdad[i] / totalEmbolsado) * factorRepique
      })
      return aplicarPisoRecobro(resultado, PISO_RECOBRO_PROYECTADO)
    }

    // Respaldo: forma del histórico importado (si lo hay) escalada al
    // recobro típico de respaldo; si tampoco hay histórico, la curva fija.
    const forma = calcularDistribucionRespaldo(cosechaEdadHistorica.map((f) => ({ edad_semanas: f.edad_semanas, racimos: f.racimos })))
    const resultado = {} as DistribucionEdad
    for (const edad of EDADES_COSECHA) resultado[edad] = forma[edad] * RECOBRO_RESPALDO
    return aplicarPisoRecobro(resultado, PISO_RECOBRO_PROYECTADO)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modeloManual,
    anioActual,
    semanaActual,
    embolseRealPorSemana,
    historico,
    racimosRealesDeEdad,
    repicadoPorSemanaEmbolse,
    cosechaEdadHistorica,
  ])

  const recobroProyectado = useMemo(
    () => EDADES_COSECHA.reduce((suma, edad) => suma + distribucionProyeccion[edad], 0),
    [distribucionProyeccion],
  )

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
    recobroProyectado,
    distribucionProyeccion,
    modeloEsManual,
    refetchModelo,
    loading,
    anioActual,
    semanaActual,
  }
}

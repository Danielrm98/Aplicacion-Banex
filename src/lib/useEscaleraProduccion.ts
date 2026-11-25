import { useMemo } from 'react'
import { useEmbolses } from './useEmbolses'
import { useEmbolseHistorico } from './useEmbolseHistorico'
import { useCosechaPorEdad } from './useCosechaPorEdad'
import { useRacimosPorEdadReal } from './useRacimosPorEdadReal'
import { useModeloEdad } from './useModeloEdad'
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
// Cuánto hacia atrás se busca la última cohorte de embolse ya completa
// (con las 7 edades ya cosechadas) para tomar su recobro y su % por edad
// reales — "lo que quedó la semana anterior" — como base de la proyección.
const SEMANAS_BUSQUEDA_RECOBRO = 40
// Recobro de respaldo si todavía no hay ninguna cohorte completa (finca
// nueva, sin historial ni formulario diario cargado aún).
const RECOBRO_RESPALDO = 0.85

/** Arma la escalera de producción de una finca: semana de embolse → semana
 * de cosecha, con lo real ya cargado (embolses de la app + semilla
 * histórica importada + racimos por edad del formulario diario de
 * Registrar + repique real) y lo futuro proyectado. La proyección de
 * racimos cosechados usa el Recobro real de la última cohorte de embolse
 * ya completa ("lo que quedó la semana anterior"), no un promedio de todo
 * el histórico — igual que el ratio cajas/racimo (ver useRacimosPorEdadReal).
 * Ventana fija de 13 semanas atrás y 13 adelante (cubre el rango de edad
 * de cosecha, 7-13 semanas). También devuelve la serie completa de Bell/Ha
 * para el gráfico comparativo por años. */
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
  const { mapa: racimosEdadReal, ratioCajas20kgPorRacimo, loading: loadingProduccion } = useRacimosPorEdadReal(nombreFinca)
  const { filas: modeloManual, loading: loadingModelo, refetch: refetchModelo } = useModeloEdad(nombreFinca)

  const loading =
    loadingEmbolses || loadingRepiques || loadingLotes || loadingHistorico || loadingCosecha || loadingProduccion || loadingModelo

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

  // "Lo que quedó la semana anterior": se busca hacia atrás la cohorte de
  // embolse más reciente que ya tenga las 7 edades cosechadas (no una a
  // medias, que todavía podría subir) y se usa SU % real de racimos por
  // edad (reescalado para incluir también el repique real de esa cohorte,
  // igual que el Recobro de la página Recobro) como base para proyectar
  // las cohortes futuras — tanto el nivel (recobro) como la forma (qué
  // edades pesan más) quedan "parecidos a la semana anterior", no
  // diluidos en un promedio de todo el histórico.
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

    let cursor = sumarSemanas(anioActual, semanaActual, -EDADES_COSECHA[EDADES_COSECHA.length - 1])
    for (let i = 0; i < SEMANAS_BUSQUEDA_RECOBRO; i++) {
      const embolsado = embolsadoDe(cursor.anio, cursor.semana)
      if (embolsado && embolsado > 0) {
        const racimosPorEdadCohorte = EDADES_COSECHA.map((edad) => racimosRealesDeEdad(cursor.anio, cursor.semana, edad))
        const todasReales = racimosPorEdadCohorte.every((v) => v !== undefined)
        if (todasReales) {
          const cosechado = racimosPorEdadCohorte.reduce((suma, v) => suma + (v ?? 0), 0)
          const repicado = repicadoPorSemanaEmbolse.get(`${cursor.anio}_${cursor.semana}`) ?? 0
          // Factor para que la distribución, al sumarla, dé el recobro
          // completo (cosechado + repicado) y no solo lo cosechado —
          // conserva la forma real por edad, solo ajusta el nivel.
          const factorRepique = cosechado > 0 ? (cosechado + repicado) / cosechado : 1
          const resultado = {} as DistribucionEdad
          EDADES_COSECHA.forEach((edad, i2) => {
            resultado[edad] = ((racimosPorEdadCohorte[i2] ?? 0) / embolsado) * factorRepique
          })
          return resultado
        }
      }
      cursor = sumarSemanas(cursor.anio, cursor.semana, -1)
    }
    // Respaldo: forma del histórico importado (si lo hay) escalada al
    // recobro típico de respaldo; si tampoco hay histórico, la curva fija.
    const forma = calcularDistribucionRespaldo(cosechaEdadHistorica.map((f) => ({ edad_semanas: f.edad_semanas, racimos: f.racimos })))
    const resultado = {} as DistribucionEdad
    for (const edad of EDADES_COSECHA) resultado[edad] = forma[edad] * RECOBRO_RESPALDO
    return resultado
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
    recobroProyectado,
    distribucionProyeccion,
    modeloEsManual,
    refetchModelo,
    loading,
    anioActual,
    semanaActual,
  }
}

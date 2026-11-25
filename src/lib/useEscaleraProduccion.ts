import { useMemo } from 'react'
import { useEmbolses } from './useEmbolses'
import { useEmbolseHistorico } from './useEmbolseHistorico'
import { useCosechaPorEdad } from './useCosechaPorEdad'
import { useLotes } from './useLotes'
import { getIsoWeek, getIsoYear } from './isoWeek'
import { fechaLocalHoy } from './fechaLocal'
import { sumarSemanas } from './anioEmbolses'
import { calcularDistribucionRespaldo, calcularFilaEscalera, type PuntoSerie, type FilaEscalera } from './calculoEscaleraProduccion'
import type { EdadCosecha } from '../types/escaleraProduccion'
import type { Finca } from '../types/finca'

const SEMANAS_ATRAS = 13
const SEMANAS_ADELANTE = 13

/** Arma la escalera de producción de una finca: semana de embolse → semana
 * de cosecha, con lo real ya cargado (embolses de la app + semilla
 * histórica importada + "Registro semanal" por edad) y lo futuro
 * proyectado. Ventana fija de 13 semanas atrás y 13 adelante (cubre el
 * rango de edad de cosecha, 8-13 semanas). También devuelve la serie
 * completa de Bell/Ha (sin recortar a la ventana) para el gráfico
 * comparativo por años. */
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
  const { lotes, loading: loadingLotes } = useLotes()
  const { filas: historico, loading: loadingHistorico } = useEmbolseHistorico(nombreFinca)
  const { filas: cosechaEdad, loading: loadingCosecha } = useCosechaPorEdad(nombreFinca)

  const loading = loadingEmbolses || loadingLotes || loadingHistorico || loadingCosecha

  // Serie completa de Bell/Ha (todo el historial, no solo la ventana) — la
  // usa tanto la proyección estacional como el gráfico comparativo por años.
  const serieBellPorHa = useMemo<PuntoSerie[]>(() => {
    if (!finca) return []
    const lotesFinca = new Set(lotes.filter((l) => l.finca === finca.nombre).map((l) => l.id))
    const embolseRealPorSemana = new Map<string, number>()
    for (const e of embolses) {
      if (!lotesFinca.has(e.lote_id)) continue
      const clave = `${e.anio}_${e.semana}`
      embolseRealPorSemana.set(clave, (embolseRealPorSemana.get(clave) ?? 0) + e.cantidad)
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, lotes, embolses, historico])

  const embolseRealPorSemana = useMemo(() => {
    if (!finca) return new Map<string, number>()
    const lotesFinca = new Set(lotes.filter((l) => l.finca === finca.nombre).map((l) => l.id))
    const mapa = new Map<string, number>()
    for (const e of embolses) {
      if (!lotesFinca.has(e.lote_id)) continue
      const clave = `${e.anio}_${e.semana}`
      mapa.set(clave, (mapa.get(clave) ?? 0) + e.cantidad)
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, lotes, embolses])

  const racimosPorEdadMap = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const f of cosechaEdad) mapa.set(`${f.anio}_${f.semana}_${f.edad_semanas}`, f.racimos)
    return mapa
  }, [cosechaEdad])

  const filas = useMemo<FilaEscalera[]>(() => {
    if (!finca) return []
    const distribucionRespaldo = calcularDistribucionRespaldo(cosechaEdad)

    const semanaYaOcurrida = (semana: { anio: number; semana: number }) =>
      semana.anio < anioActual || (semana.anio === anioActual && semana.semana <= semanaActual)

    const racimosRealesDeEdad = (anio: number, semana: number, edad: EdadCosecha) => racimosPorEdadMap.get(`${anio}_${semana}_${edad}`)

    const resultado: FilaEscalera[] = []
    let cursor = inicio
    // Tope de seguridad (52+27) para no colgar la pestaña si algo deja el
    // bucle sin converger — nunca debería hacer falta con la ventana fija.
    for (let i = 0; i < SEMANAS_ATRAS + SEMANAS_ADELANTE + 5; i++) {
      if (cursor.anio > fin.anio || (cursor.anio === fin.anio && cursor.semana > fin.semana)) break

      const claveReal = `${cursor.anio}_${cursor.semana}`
      let embolseRealDeEstaSemana: number | null = embolseRealPorSemana.get(claveReal) ?? null
      if (embolseRealDeEstaSemana === null) {
        const h = historico.find((x) => x.anio === cursor.anio && x.semana === cursor.semana)
        embolseRealDeEstaSemana = h?.emb_real ?? null
      }

      resultado.push(
        calcularFilaEscalera({
          anioEmbolse: cursor.anio,
          semanaEmbolse: cursor.semana,
          hectareas: finca.hectareas,
          embolseRealDeEstaSemana,
          serieBellPorHa,
          distribucionRespaldo,
          racimosRealesDeEdad,
          semanaYaOcurrida,
        }),
      )
      cursor = sumarSemanas(cursor.anio, cursor.semana, 1)
    }
    return resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, cosechaEdad, racimosPorEdadMap, embolseRealPorSemana, historico, serieBellPorHa, inicio.anio, inicio.semana, fin.anio, fin.semana, anioActual, semanaActual])

  return { filas, serieBellPorHa, loading, anioActual, semanaActual }
}

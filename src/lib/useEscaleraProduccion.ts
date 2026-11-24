import { useMemo } from 'react'
import { useEmbolses } from './useEmbolses'
import { useEmbolseHistorico } from './useEmbolseHistorico'
import { useCosechaPorEdad } from './useCosechaPorEdad'
import { useLotes } from './useLotes'
import { getIsoWeek, getIsoYear } from './isoWeek'
import { fechaLocalHoy } from './fechaLocal'
import { sumarSemanas } from './anioEmbolses'
import { calcularDistribucionEdad, calcularFilaEscalera, type PuntoSerie, type FilaEscalera } from './calculoEscaleraProduccion'
import type { Finca } from '../types/finca'

const SEMANAS_ATRAS = 13
const SEMANAS_ADELANTE = 13

/** Arma la escalera de producción de una finca: semana de embolse → semana
 * de cosecha, con lo real ya cargado (embolses de la app + semilla
 * histórica importada) y lo futuro proyectado. Ventana fija de 13 semanas
 * atrás y 13 adelante (cubre el rango de edad de cosecha, 8-13 semanas). */
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

  const filas = useMemo<FilaEscalera[]>(() => {
    if (!finca) return []
    const lotesFinca = new Set(lotes.filter((l) => l.finca === finca.nombre).map((l) => l.id))
    const embolseRealPorSemana = new Map<string, number>()
    for (const e of embolses) {
      if (!lotesFinca.has(e.lote_id)) continue
      const clave = `${e.anio}_${e.semana}`
      embolseRealPorSemana.set(clave, (embolseRealPorSemana.get(clave) ?? 0) + e.cantidad)
    }

    const hectareas = finca.hectareas
    const serieBellPorHa: PuntoSerie[] = []
    for (const h of historico) {
      if (h.bell_por_ha != null) serieBellPorHa.push({ anio: h.anio, semana: h.semana, valor: h.bell_por_ha })
    }
    if (hectareas) {
      for (const [clave, cantidad] of embolseRealPorSemana) {
        const [anioStr, semanaStr] = clave.split('_')
        serieBellPorHa.push({ anio: Number(anioStr), semana: Number(semanaStr), valor: cantidad / hectareas })
      }
    }

    const distribucionEdad = calcularDistribucionEdad(cosechaEdad)

    const semanaCosechaYaOcurrida = (semana: { anio: number; semana: number }) =>
      semana.anio < anioActual || (semana.anio === anioActual && semana.semana <= semanaActual)

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
          hectareas,
          embolseRealDeEstaSemana,
          serieBellPorHa,
          distribucionEdad,
          semanaCosechaYaOcurrida,
        }),
      )
      cursor = sumarSemanas(cursor.anio, cursor.semana, 1)
    }
    return resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, lotes, embolses, historico, cosechaEdad, inicio.anio, inicio.semana, fin.anio, fin.semana, anioActual, semanaActual])

  return { filas, loading, anioActual, semanaActual }
}

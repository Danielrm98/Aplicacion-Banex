import { useMemo } from 'react'
import { useProducciones } from './useProducciones'
import { useReferencias } from './useReferencias'
import { semanaEmbolseDeEdad } from './cintaEmbolse'
import { anioDeSemana } from './isoWeek'
import { EDADES_COSECHA } from '../types/escaleraProduccion'

// Ventana "reciente" para los ratios cajas/racimo: ~12 semanas.
const DIAS_VENTANA_RATIO = 84

/**
 * Racimos cosechados por edad, ya atribuidos a su semana de embolse —
 * mismo cruce que ya usa useCosechaEmbolse.ts (el inventario de embolse
 * descuenta por aquí), pero sin sumar entre edades: cada combinación
 * (finca, año/semana de embolse, edad) queda aparte, para poder mostrar el
 * desglose real de la escalera. La fuente es el formulario diario de
 * "Registrar" (producciones.racimos_semana_X), que ya se llena todos los
 * días — no hace falta una pantalla aparte para este dato. Solo se cuentan
 * las edades 8 a 12 (EDADES_COSECHA): la semana 7 se descarta por pedido
 * del usuario (muy pocos racimos reales caen ahí, resulta poco confiable).
 */
export function useRacimosPorEdadReal(finca: string | null) {
  const { registros, loading: loadingProducciones } = useProducciones({ finca: finca ?? undefined })
  const { referencias, loading: loadingReferencias } = useReferencias()

  const mapa = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registros) {
      if (!r.semana) continue
      const anioReal = anioDeSemana(r.fecha, r.semana)
      for (const edad of EDADES_COSECHA) {
        const cantidad = r[`racimos_semana_${edad}` as const]
        if (!cantidad) continue
        const { anio: anioEmbolse, semana: semanaEmbolse } = semanaEmbolseDeEdad(anioReal, r.semana, edad)
        const clave = `${anioEmbolse}_${semanaEmbolse}_${edad}`
        m.set(clave, (m.get(clave) ?? 0) + cantidad)
      }
    }
    return m
  }, [registros])

  // Marca -> Corta/Larga, del catálogo de referencias — "Larga" es la
  // misma categoría que el Excel llama "Premium" (fruta larga/exportable).
  const especificacionPorMarca = useMemo(() => new Map(referencias.map((r) => [r.marca, r.especificacion])), [referencias])

  // Ratios de las últimas semanas (no de todo el histórico, para que la
  // proyección refleje el rendimiento actual de la finca): cajas 20kg
  // (equivalente normalizado), cajas físicas, y el split Corta/Premium
  // (Larga), todo por racimo cosechado. Mismo criterio que "Ratio Total",
  // "Ratio Corta" y "Ratio Premium" en el Excel.
  const ratios = useMemo(() => {
    const cortaFecha = new Date()
    cortaFecha.setDate(cortaFecha.getDate() - DIAS_VENTANA_RATIO)
    const corte = cortaFecha.toISOString().slice(0, 10)

    let totalCajas20kg = 0
    let totalCajasFisicas = 0
    let totalCajas20kgCorta = 0
    let totalCajas20kgPremium = 0
    let totalRacimos = 0
    for (const r of registros) {
      if (!r.semana || r.fecha < corte) continue
      totalCajas20kg += r.items.reduce((suma, it) => suma + it.cajas_20kg, 0)
      totalCajasFisicas += r.items.reduce((suma, it) => suma + it.cantidad_cajas, 0)
      for (const it of r.items) {
        const especificacion = especificacionPorMarca.get(it.referencia)
        if (especificacion === 'Corta') totalCajas20kgCorta += it.cajas_20kg
        else if (especificacion === 'Larga') totalCajas20kgPremium += it.cajas_20kg
      }
      totalRacimos += EDADES_COSECHA.reduce((suma, edad) => suma + (r[`racimos_semana_${edad}` as const] || 0), 0)
    }
    return {
      ratioCajas20kgPorRacimo: totalRacimos > 0 ? totalCajas20kg / totalRacimos : 0,
      ratioCajasFisicasPorRacimo: totalRacimos > 0 ? totalCajasFisicas / totalRacimos : 0,
      ratioCortaPorRacimo: totalRacimos > 0 ? totalCajas20kgCorta / totalRacimos : 0,
      ratioPremiumPorRacimo: totalRacimos > 0 ? totalCajas20kgPremium / totalRacimos : 0,
    }
  }, [registros, especificacionPorMarca])

  return {
    mapa,
    ratioCajas20kgPorRacimo: ratios.ratioCajas20kgPorRacimo,
    ratioCajasFisicasPorRacimo: ratios.ratioCajasFisicasPorRacimo,
    ratioCortaPorRacimo: ratios.ratioCortaPorRacimo,
    ratioPremiumPorRacimo: ratios.ratioPremiumPorRacimo,
    loading: loadingProducciones || loadingReferencias,
  }
}

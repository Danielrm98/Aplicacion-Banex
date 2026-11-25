import { useMemo } from 'react'
import { useProducciones } from './useProducciones'
import { semanaEmbolseDeEdad } from './cintaEmbolse'
import { anioDeSemana } from './isoWeek'
import { SEMANAS_RACIMO } from '../types/produccion'

// Ventana "reciente" para el ratio cajas/racimo: ~12 semanas.
const DIAS_VENTANA_RATIO = 84

/**
 * Racimos cosechados por edad, ya atribuidos a su semana de embolse —
 * mismo cruce que ya usa useCosechaEmbolse.ts (el inventario de embolse
 * descuenta por aquí), pero sin sumar entre edades: cada combinación
 * (finca, año/semana de embolse, edad) queda aparte, para poder mostrar el
 * desglose real de la escalera. La fuente es el formulario diario de
 * "Registrar" (producciones.racimos_semana_7..12), que ya se llena todos
 * los días — no hace falta una pantalla aparte para este dato.
 */
export function useRacimosPorEdadReal(finca: string | null) {
  const { registros, loading } = useProducciones({ finca: finca ?? undefined })

  const mapa = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registros) {
      if (!r.semana) continue
      const anioReal = anioDeSemana(r.fecha, r.semana)
      for (const edad of SEMANAS_RACIMO) {
        const cantidad = r[`racimos_semana_${edad}` as const]
        if (!cantidad) continue
        const { anio: anioEmbolse, semana: semanaEmbolse } = semanaEmbolseDeEdad(anioReal, r.semana, edad)
        const clave = `${anioEmbolse}_${semanaEmbolse}_${edad}`
        m.set(clave, (m.get(clave) ?? 0) + cantidad)
      }
    }
    return m
  }, [registros])

  // Ratios de las últimas semanas (no de todo el histórico, para que la
  // proyección refleje el rendimiento actual de la finca): cajas 20kg
  // (equivalente normalizado) y cajas físicas, por racimo cosechado. Mismo
  // criterio que "Ratio Total" en el Excel.
  const ratios = useMemo(() => {
    const cortaFecha = new Date()
    cortaFecha.setDate(cortaFecha.getDate() - DIAS_VENTANA_RATIO)
    const corte = cortaFecha.toISOString().slice(0, 10)

    let totalCajas20kg = 0
    let totalCajasFisicas = 0
    let totalRacimos = 0
    for (const r of registros) {
      if (!r.semana || r.fecha < corte) continue
      totalCajas20kg += r.items.reduce((suma, it) => suma + it.cajas_20kg, 0)
      totalCajasFisicas += r.items.reduce((suma, it) => suma + it.cantidad_cajas, 0)
      totalRacimos += SEMANAS_RACIMO.reduce((suma, edad) => suma + (r[`racimos_semana_${edad}` as const] || 0), 0)
    }
    return {
      ratioCajas20kgPorRacimo: totalRacimos > 0 ? totalCajas20kg / totalRacimos : 0,
      ratioCajasFisicasPorRacimo: totalRacimos > 0 ? totalCajasFisicas / totalRacimos : 0,
    }
  }, [registros])

  return { mapa, ratioCajas20kgPorRacimo: ratios.ratioCajas20kgPorRacimo, ratioCajasFisicasPorRacimo: ratios.ratioCajasFisicasPorRacimo, loading }
}

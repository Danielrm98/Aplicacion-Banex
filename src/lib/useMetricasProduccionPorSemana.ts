import { useMemo } from 'react'
import { useProducciones } from './useProducciones'
import { useReferencias } from './useReferencias'
import { anioDeSemana } from './isoWeek'
import { CAJA_20KG_KG, CANASTILLA_KG, SEMANAS_RACIMO } from '../types/produccion'
import { EDADES_COSECHA } from '../types/escaleraProduccion'

export interface MetricasSemana {
  anio: number
  semana: number
  racimosCosechados: number
  racimosRecusados: number
  cajas20kgTotal: number
  cantidadCajasTotal: number
  canastillas: number
  frutaNoVendida: number
  areaRecorrida: number
  promedioManos: number | null
  gradoPromedio: number | null
  pesoNetoRacimo: number | null
  merma: number | null
  // Split Corta/Premium (Larga en el catálogo de referencias), en cajas
  // 20kg — "Premium" es la misma categoría que el catálogo llama "Larga".
  cajas20kgCorta: number
  cajas20kgPremium: number
  porcentajeCorta: number | null
  porcentajePremium: number | null
  ratioCorta: number | null
  ratioPremium: number | null
}

/**
 * Métricas REALES (nunca proyectadas) de "Registrar", agregadas por semana
 * de cosecha (calendario, no de embolse) — mismas fórmulas que ya usa
 * aggregations.ts (resumenPorDiaFinca) para peso neto racimo, ratio y
 * merma, aquí sumadas por semana en vez de por día. Lo que todavía no ha
 * pasado simplemente no tiene fila aquí (igual que en el Excel: estas
 * columnas no se proyectan, solo se llenan cuando ya se registró).
 */
export function useMetricasProduccionPorSemana(finca: string | null) {
  const { registros, loading: loadingProducciones } = useProducciones({ finca: finca ?? undefined })
  const { referencias, loading: loadingReferencias } = useReferencias()

  const especificacionPorMarca = useMemo(() => new Map(referencias.map((r) => [r.marca, r.especificacion])), [referencias])

  const mapa = useMemo(() => {
    interface Acumulador {
      racimosCosechados: number
      racimosRecusados: number
      cajas20kg: number
      cantidadCajas: number
      cajas20kgCorta: number
      cajas20kgPremium: number
      canastillas: number
      frutaNoVendida: number
      areaRecorrida: number
      sumaManos: number
      countManos: number
      sumaGrado: number
      countGrado: number
    }
    const acumuladores = new Map<string, Acumulador>()
    for (const r of registros) {
      if (!r.semana) continue
      const anio = anioDeSemana(r.fecha, r.semana)
      const clave = `${anio}_${r.semana}`
      const acc = acumuladores.get(clave) ?? {
        racimosCosechados: 0,
        racimosRecusados: 0,
        cajas20kg: 0,
        cantidadCajas: 0,
        cajas20kgCorta: 0,
        cajas20kgPremium: 0,
        canastillas: 0,
        frutaNoVendida: 0,
        areaRecorrida: 0,
        sumaManos: 0,
        countManos: 0,
        sumaGrado: 0,
        countGrado: 0,
      }
      // Solo 8-12 (EDADES_COSECHA): igual que en el resto de la escalera, se
      // descarta la semana 7 por poco confiable, a pedido del usuario.
      acc.racimosCosechados += EDADES_COSECHA.reduce((suma, edad) => suma + (r[`racimos_semana_${edad}` as const] || 0), 0)
      acc.racimosRecusados += r.racimos_recusados
      acc.cajas20kg += r.items.reduce((suma, it) => suma + it.cajas_20kg, 0)
      acc.cantidadCajas += r.items.reduce((suma, it) => suma + it.cantidad_cajas, 0)
      for (const it of r.items) {
        const especificacion = especificacionPorMarca.get(it.referencia)
        if (especificacion === 'Corta') acc.cajas20kgCorta += it.cajas_20kg
        else if (especificacion === 'Larga') acc.cajas20kgPremium += it.cajas_20kg
      }
      acc.canastillas += r.canastillas
      acc.frutaNoVendida += r.fruta_no_vendida
      acc.areaRecorrida += r.area_recorrida ?? 0
      if (r.promedio_manos != null) {
        acc.sumaManos += r.promedio_manos
        acc.countManos += 1
      }
      const grados = SEMANAS_RACIMO.map((edad) => r[`grado_semana_${edad}` as const]).filter((g): g is number => g !== null)
      if (grados.length > 0) {
        acc.sumaGrado += grados.reduce((suma, g) => suma + g, 0) / grados.length
        acc.countGrado += 1
      }
      acumuladores.set(clave, acc)
    }

    const resultado = new Map<string, MetricasSemana>()
    for (const [clave, acc] of acumuladores) {
      const [anioStr, semanaStr] = clave.split('_')
      const kilosCajas20kg = acc.cajas20kg * CAJA_20KG_KG
      const kilosCanastillas = acc.canastillas * CANASTILLA_KG
      const kilosFrutaNoVendida = acc.frutaNoVendida * CANASTILLA_KG
      const kilosMerma = kilosCanastillas + kilosFrutaNoVendida
      const pesoTotal = kilosCajas20kg + kilosMerma
      const totalCortaPremium = acc.cajas20kgCorta + acc.cajas20kgPremium
      resultado.set(clave, {
        anio: Number(anioStr),
        semana: Number(semanaStr),
        racimosCosechados: acc.racimosCosechados,
        racimosRecusados: acc.racimosRecusados,
        cajas20kgTotal: acc.cajas20kg,
        cantidadCajasTotal: acc.cantidadCajas,
        canastillas: acc.canastillas,
        frutaNoVendida: acc.frutaNoVendida,
        areaRecorrida: acc.areaRecorrida,
        promedioManos: acc.countManos > 0 ? acc.sumaManos / acc.countManos : null,
        gradoPromedio: acc.countGrado > 0 ? acc.sumaGrado / acc.countGrado : null,
        pesoNetoRacimo: acc.racimosCosechados > 0 ? pesoTotal / acc.racimosCosechados : null,
        merma: pesoTotal > 0 ? (kilosMerma / pesoTotal) * 100 : null,
        cajas20kgCorta: acc.cajas20kgCorta,
        cajas20kgPremium: acc.cajas20kgPremium,
        porcentajeCorta: totalCortaPremium > 0 ? acc.cajas20kgCorta / totalCortaPremium : null,
        porcentajePremium: totalCortaPremium > 0 ? acc.cajas20kgPremium / totalCortaPremium : null,
        ratioCorta: acc.racimosCosechados > 0 ? acc.cajas20kgCorta / acc.racimosCosechados : null,
        ratioPremium: acc.racimosCosechados > 0 ? acc.cajas20kgPremium / acc.racimosCosechados : null,
      })
    }
    return resultado
  }, [registros, especificacionPorMarca])

  return { mapa, loading: loadingProducciones || loadingReferencias }
}

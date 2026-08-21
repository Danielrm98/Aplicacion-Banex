import { CAJA_20KG_KG, CANASTILLA_KG, SEMANAS_RACIMO, type Produccion } from '../types/produccion'

export interface FilaProduccion {
  fecha: string
  semana: number
  finca: string
  referencia: string
  peso_neto_kg: number
  cantidad_cajas: number
  cajas_20kg: number
  cajas_rechazadas: number
  motivo_rechazo: string
}

export interface PuntoFecha {
  fecha: string
  cajas: number
  rechazadas: number
  tasaRechazo: number
}

export interface PuntoFinca {
  finca: string
  cajas: number
}

export function flattenItems(registros: Produccion[]): FilaProduccion[] {
  return registros.flatMap((r) =>
    r.items.map((item) => ({
      fecha: r.fecha,
      semana: r.semana,
      finca: r.finca,
      referencia: item.referencia,
      peso_neto_kg: item.peso_neto_kg,
      cantidad_cajas: item.cantidad_cajas,
      cajas_20kg: item.cajas_20kg,
      cajas_rechazadas: item.cajas_rechazadas,
      motivo_rechazo: item.motivo_rechazo ?? '',
    })),
  )
}

export function porFecha(filas: FilaProduccion[]): PuntoFecha[] {
  const map = new Map<string, { cajas: number; rechazadas: number }>()

  for (const f of filas) {
    const acc = map.get(f.fecha) ?? { cajas: 0, rechazadas: 0 }
    acc.cajas += f.cantidad_cajas
    acc.rechazadas += f.cajas_rechazadas
    map.set(f.fecha, acc)
  }

  return Array.from(map.entries())
    .map(([fecha, v]) => ({
      fecha,
      cajas: v.cajas,
      rechazadas: v.rechazadas,
      tasaRechazo: v.cajas + v.rechazadas > 0 ? (v.rechazadas / (v.cajas + v.rechazadas)) * 100 : 0,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function porFinca(filas: FilaProduccion[]): PuntoFinca[] {
  const map = new Map<string, number>()

  for (const f of filas) {
    map.set(f.finca, (map.get(f.finca) ?? 0) + f.cantidad_cajas)
  }

  return Array.from(map.entries())
    .map(([finca, cajas]) => ({ finca, cajas }))
    .sort((a, b) => b.cajas - a.cajas)
}

export function totales(filas: FilaProduccion[]) {
  const cajas = filas.reduce((sum, f) => sum + f.cantidad_cajas, 0)
  const cajas20kg = filas.reduce((sum, f) => sum + f.cajas_20kg, 0)
  const rechazadas = filas.reduce((sum, f) => sum + f.cajas_rechazadas, 0)
  const tasaRechazo = cajas + rechazadas > 0 ? (rechazadas / (cajas + rechazadas)) * 100 : 0
  return { cajas, cajas20kg, rechazadas, tasaRechazo }
}

export interface ResumenRegistro {
  fecha: string
  semana: number
  finca: string
  cajas20kg: number
  kilosCajas20kg: number
  kilosCanastillas: number
  racimosCosechados: number
  racimosPorEdad: Record<number, number>
}

export function resumenPorRegistro(registros: Produccion[]): ResumenRegistro[] {
  return registros.map((r) => {
    const cajas20kg = r.items.reduce((sum, it) => sum + it.cajas_20kg, 0)
    const racimosPorEdad = Object.fromEntries(
      SEMANAS_RACIMO.map((s) => [s, r[`racimos_semana_${s}` as const]]),
    ) as Record<number, number>
    const racimosCosechados = SEMANAS_RACIMO.reduce((sum, s) => sum + r[`racimos_semana_${s}` as const], 0)

    return {
      fecha: r.fecha,
      semana: r.semana,
      finca: r.finca,
      cajas20kg,
      kilosCajas20kg: cajas20kg * CAJA_20KG_KG,
      kilosCanastillas: r.canastillas * CANASTILLA_KG,
      racimosCosechados,
      racimosPorEdad,
    }
  })
}

export interface PuntoEdad {
  edad: number
  racimos: number
}

export function racimosPorEdad(resumenes: ResumenRegistro[]): PuntoEdad[] {
  return SEMANAS_RACIMO.map((edad) => ({
    edad,
    racimos: resumenes.reduce((sum, r) => sum + r.racimosPorEdad[edad], 0),
  }))
}

export function racimosPorFinca(resumenes: ResumenRegistro[]): PuntoFinca[] {
  const map = new Map<string, number>()
  for (const r of resumenes) {
    map.set(r.finca, (map.get(r.finca) ?? 0) + r.racimosCosechados)
  }
  return Array.from(map.entries())
    .map(([finca, cajas]) => ({ finca, cajas }))
    .sort((a, b) => b.cajas - a.cajas)
}

export interface PuntoSemana {
  semana: number
  racimos: number
}

export function racimosPorSemana(resumenes: ResumenRegistro[]): PuntoSemana[] {
  const map = new Map<number, number>()
  for (const r of resumenes) {
    map.set(r.semana, (map.get(r.semana) ?? 0) + r.racimosCosechados)
  }
  return Array.from(map.entries())
    .map(([semana, racimos]) => ({ semana, racimos }))
    .sort((a, b) => a.semana - b.semana)
}

export function totalRacimosCosechados(resumenes: ResumenRegistro[]) {
  return resumenes.reduce((sum, r) => sum + r.racimosCosechados, 0)
}

interface AcumuladoRatioMerma {
  cajas20kg: number
  racimos: number
  kilosCajas20kg: number
  kilosCanastillas: number
}

function ratioDe(a: AcumuladoRatioMerma) {
  return a.racimos > 0 ? a.cajas20kg / a.racimos : null
}

function mermaDe(a: AcumuladoRatioMerma) {
  const pesoTotal = a.kilosCajas20kg + a.kilosCanastillas
  return pesoTotal > 0 ? (a.kilosCanastillas / pesoTotal) * 100 : null
}

export interface PuntoRatioMermaFinca {
  finca: string
  ratio: number | null
  merma: number | null
}

export function ratioMermaPorFinca(resumenes: ResumenRegistro[]): PuntoRatioMermaFinca[] {
  const map = new Map<string, AcumuladoRatioMerma>()
  for (const r of resumenes) {
    const acc = map.get(r.finca) ?? { cajas20kg: 0, racimos: 0, kilosCajas20kg: 0, kilosCanastillas: 0 }
    acc.cajas20kg += r.cajas20kg
    acc.racimos += r.racimosCosechados
    acc.kilosCajas20kg += r.kilosCajas20kg
    acc.kilosCanastillas += r.kilosCanastillas
    map.set(r.finca, acc)
  }
  return Array.from(map.entries())
    .map(([finca, acc]) => ({ finca, ratio: ratioDe(acc), merma: mermaDe(acc) }))
    .sort((a, b) => a.finca.localeCompare(b.finca))
}

export interface PuntoRatioMermaSemana {
  semana: number
  ratio: number | null
  merma: number | null
}

export function ratioMermaPorSemana(resumenes: ResumenRegistro[]): PuntoRatioMermaSemana[] {
  const map = new Map<number, AcumuladoRatioMerma>()
  for (const r of resumenes) {
    const acc = map.get(r.semana) ?? { cajas20kg: 0, racimos: 0, kilosCajas20kg: 0, kilosCanastillas: 0 }
    acc.cajas20kg += r.cajas20kg
    acc.racimos += r.racimosCosechados
    acc.kilosCajas20kg += r.kilosCajas20kg
    acc.kilosCanastillas += r.kilosCanastillas
    map.set(r.semana, acc)
  }
  return Array.from(map.entries())
    .map(([semana, acc]) => ({ semana, ratio: ratioDe(acc), merma: mermaDe(acc) }))
    .sort((a, b) => a.semana - b.semana)
}

export interface ResumenDiaFinca {
  fecha: string
  semana: number
  finca: string
  horaFinalizacion: string
  racimosCosechados: number
  racimosRecusados: number
  racimosProcesados: number
  canastillas: number
  kilosCanastillas: number
  pesoNetoRacimo: number | null
  ratio: number | null
  merma: number | null
  transporte: string
  notas: string
}

/**
 * Un registro (producciones) ya es un único día + finca, así que esto
 * produce una fila por registro sin repetir por cada referencia/línea.
 */
export function resumenPorDiaFinca(registros: Produccion[]): ResumenDiaFinca[] {
  return registros.map((r) => {
    const cajas20kgTotal = r.items.reduce((sum, it) => sum + it.cajas_20kg, 0)
    const kilosCajas20kg = cajas20kgTotal * CAJA_20KG_KG
    const kilosCanastillas = r.canastillas * CANASTILLA_KG
    const racimosCosechados = SEMANAS_RACIMO.reduce((sum, s) => sum + r[`racimos_semana_${s}` as const], 0)
    const racimosProcesados = racimosCosechados - r.racimos_recusados
    const pesoTotal = kilosCajas20kg + kilosCanastillas
    const pesoNetoRacimo = racimosCosechados > 0 ? pesoTotal / racimosCosechados : null
    const ratio = racimosCosechados > 0 ? cajas20kgTotal / racimosCosechados : null
    const merma = pesoTotal > 0 ? (kilosCanastillas / pesoTotal) * 100 : null
    const transporte = r.transportes
      .map((t) => {
        const partes = [t.tipo, t.placa, t.hora_llegada && t.hora_salida ? `${t.hora_llegada}-${t.hora_salida}` : t.hora_llegada]
        return partes.filter(Boolean).join(' ')
      })
      .join('; ')

    return {
      fecha: r.fecha,
      semana: r.semana,
      finca: r.finca,
      horaFinalizacion: r.hora_finalizacion ?? '',
      racimosCosechados,
      racimosRecusados: r.racimos_recusados,
      racimosProcesados,
      canastillas: r.canastillas,
      kilosCanastillas,
      pesoNetoRacimo,
      ratio,
      merma,
      transporte,
      notas: r.notas ?? '',
    }
  })
}

export interface FilaCompleta extends ResumenDiaFinca {
  referencia: string
  cantidadCajas: number
  pesoNetoKg: number
  cajas20kg: number
  cajasRechazadas: number
  motivoRechazo: string
}

export function filaCompleta(registros: Produccion[]): FilaCompleta[] {
  const resumenes = resumenPorDiaFinca(registros)

  return registros.flatMap((r, i) => {
    const base = resumenes[i]

    if (r.items.length === 0) {
      return [
        {
          ...base,
          referencia: '',
          cantidadCajas: 0,
          pesoNetoKg: 0,
          cajas20kg: 0,
          cajasRechazadas: 0,
          motivoRechazo: '',
        },
      ]
    }

    return r.items.map((item) => ({
      ...base,
      referencia: item.referencia,
      cantidadCajas: item.cantidad_cajas,
      pesoNetoKg: item.peso_neto_kg,
      cajas20kg: item.cajas_20kg,
      cajasRechazadas: item.cajas_rechazadas,
      motivoRechazo: item.motivo_rechazo ?? '',
    }))
  })
}

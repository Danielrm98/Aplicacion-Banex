import { CAJA_20KG_KG, CANASTILLA_KG, SEMANAS_RACIMO, type Produccion } from '../types/produccion'
import { diaSemana } from './diaSemana'
import { getIsoWeek } from './isoWeek'

export interface FilaProduccion {
  fecha: string
  semana: number
  finca: string
  referencia: string
  peso_neto_kg: number
  cantidad_cajas: number
  cajas_20kg: number
}

export interface PuntoFecha {
  fecha: string
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
    })),
  )
}

export function porFecha(filas: FilaProduccion[]): PuntoFecha[] {
  const map = new Map<string, number>()

  for (const f of filas) {
    map.set(f.fecha, (map.get(f.fecha) ?? 0) + f.cantidad_cajas)
  }

  return Array.from(map.entries())
    .map(([fecha, cajas]) => ({ fecha, cajas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface PuntoSemanaValor {
  semana: number
  valor: number
}

export interface SerieFincaSemana {
  finca: string
  total: number
  puntos: PuntoSemanaValor[]
}

function porFincaYSemana(entradas: { finca: string; semana: number; valor: number }[]): SerieFincaSemana[] {
  const porFincaSemana = new Map<string, Map<number, number>>()

  for (const e of entradas) {
    const porSemana = porFincaSemana.get(e.finca) ?? new Map<number, number>()
    porSemana.set(e.semana, (porSemana.get(e.semana) ?? 0) + e.valor)
    porFincaSemana.set(e.finca, porSemana)
  }

  return Array.from(porFincaSemana.entries())
    .map(([finca, porSemana]) => {
      const puntos = Array.from(porSemana.entries())
        .map(([semana, valor]) => ({ semana, valor }))
        .sort((a, b) => a.semana - b.semana)
      const total = puntos.reduce((sum, p) => sum + p.valor, 0)
      return { finca, total, puntos }
    })
    .sort((a, b) => b.total - a.total)
}

export function cajasPorFincaYSemana(filas: FilaProduccion[]): SerieFincaSemana[] {
  return porFincaYSemana(filas.map((f) => ({ finca: f.finca, semana: f.semana, valor: f.cantidad_cajas })))
}

export function totales(filas: FilaProduccion[]) {
  const cajas = filas.reduce((sum, f) => sum + f.cantidad_cajas, 0)
  const cajas20kg = filas.reduce((sum, f) => sum + f.cajas_20kg, 0)
  return { cajas, cajas20kg }
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

export function racimosPorFincaYSemana(resumenes: ResumenRegistro[]): SerieFincaSemana[] {
  return porFincaYSemana(resumenes.map((r) => ({ finca: r.finca, semana: r.semana, valor: r.racimosCosechados })))
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
  dia: string
  semana: number
  finca: string
  horaFinalizacion: string
  racimosSemana7: number
  racimosSemana8: number
  racimosSemana9: number
  racimosSemana10: number
  racimosSemana11: number
  racimosSemana12: number
  racimosCosechados: number
  racimosRecusados: number
  racimosProcesados: number
  gradoPromedio: number | null
  promedioManos: number | null
  canastillas: number
  canastillasVendidas: number
  kilosCanastillas: number
  pesoNetoRacimo: number | null
  ratio: number | null
  merma: number | null
  transporte: string
  notas: string
  // Al final para no correr el orden de las columnas ya asignadas en el
  // Excel: las canastillas por repique son aparte de las producidas en
  // proceso y no afectan el acumulado disponible, solo se informan.
  canastillasRepique: number
}

/**
 * Un registro (producciones) ya es un único día + finca, así que esto
 * produce una fila por registro sin repetir por cada referencia/línea.
 * `ventasPorFincaFecha` (clave "finca|fecha") permite cruzar cuántas
 * canastillas se vendieron (y por repique) ese mismo día, si se conocen.
 */
export function resumenPorDiaFinca(
  registros: Produccion[],
  ventasPorFincaFecha?: Map<string, { vendidas: number; repique: number }>,
): ResumenDiaFinca[] {
  const filas = registros.map((r) => {
    const cajas20kgTotal = r.items.reduce((sum, it) => sum + it.cajas_20kg, 0)
    const kilosCajas20kg = cajas20kgTotal * CAJA_20KG_KG
    const kilosCanastillas = r.canastillas * CANASTILLA_KG
    const racimosCosechados = SEMANAS_RACIMO.reduce((sum, s) => sum + r[`racimos_semana_${s}` as const], 0)
    const racimosProcesados = racimosCosechados - r.racimos_recusados
    const gradosRegistrados = SEMANAS_RACIMO.map((s) => r[`grado_semana_${s}` as const]).filter(
      (g): g is number => g !== null,
    )
    const gradoPromedio =
      gradosRegistrados.length > 0 ? gradosRegistrados.reduce((sum, g) => sum + g, 0) / gradosRegistrados.length : null
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
      dia: diaSemana(r.fecha),
      semana: r.semana,
      finca: r.finca,
      horaFinalizacion: r.hora_finalizacion ?? '',
      racimosSemana7: r.racimos_semana_7,
      racimosSemana8: r.racimos_semana_8,
      racimosSemana9: r.racimos_semana_9,
      racimosSemana10: r.racimos_semana_10,
      racimosSemana11: r.racimos_semana_11,
      racimosSemana12: r.racimos_semana_12,
      racimosCosechados,
      racimosRecusados: r.racimos_recusados,
      racimosProcesados,
      gradoPromedio,
      promedioManos: r.promedio_manos,
      canastillas: r.canastillas,
      canastillasVendidas: ventasPorFincaFecha?.get(`${r.finca}|${r.fecha}`)?.vendidas ?? 0,
      kilosCanastillas,
      pesoNetoRacimo,
      ratio,
      merma,
      transporte,
      notas: r.notas ?? '',
      canastillasRepique: ventasPorFincaFecha?.get(`${r.finca}|${r.fecha}`)?.repique ?? 0,
    }
  })

  // Una venta (por repique, sobre todo) puede registrarse en un día/finca
  // sin registro de producción ese mismo día; sin esto, esa venta quedaría
  // invisible en el Excel en vez de aparecer con los campos de producción
  // en blanco.
  if (ventasPorFincaFecha) {
    const cubiertas = new Set(filas.map((f) => `${f.finca}|${f.fecha}`))
    for (const [clave, totales] of ventasPorFincaFecha.entries()) {
      if (cubiertas.has(clave)) continue
      const [finca, fecha] = clave.split('|')
      filas.push({
        fecha,
        dia: diaSemana(fecha),
        semana: getIsoWeek(fecha),
        finca,
        horaFinalizacion: '',
        racimosSemana7: 0,
        racimosSemana8: 0,
        racimosSemana9: 0,
        racimosSemana10: 0,
        racimosSemana11: 0,
        racimosSemana12: 0,
        racimosCosechados: 0,
        racimosRecusados: 0,
        racimosProcesados: 0,
        gradoPromedio: null,
        promedioManos: null,
        canastillas: 0,
        canastillasVendidas: totales.vendidas,
        kilosCanastillas: 0,
        pesoNetoRacimo: null,
        ratio: null,
        merma: null,
        transporte: '',
        notas: '',
        canastillasRepique: totales.repique,
      })
    }
  }

  return filas
}

export interface FilaCompleta extends ResumenDiaFinca {
  referencia: string
  cantidadCajas: number
  pesoNetoKg: number
  cajas20kg: number
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
        },
      ]
    }

    return r.items.map((item) => ({
      ...base,
      referencia: item.referencia,
      cantidadCajas: item.cantidad_cajas,
      pesoNetoKg: item.peso_neto_kg,
      cajas20kg: item.cajas_20kg,
    }))
  })
}

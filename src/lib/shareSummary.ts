import { CAJA_20KG_KG, CANASTILLA_KG, SEMANAS_RACIMO, type Produccion } from '../types/produccion'

export interface RacimoEdadResumen {
  semana: number
  racimos: number
  grado: number | null
}

export interface ReferenciaResumen {
  referencia: string
  cajas: number
  cajas20kg: number | null
  rechazadas: number
}

export interface TransporteResumen {
  tipo: string
  placa: string
  sello: string
  horaLlegada: string
  horaSalida: string
}

export interface RegistroResumenCompartir {
  fecha: string
  semana: number
  finca: string
  horaFinalizacion: string | null
  areaTotal: number | null
  areaRecorrida: number | null
  porcentajeDia: number | null
  porcentajeSemana: number | null
  racimosPorEdad: RacimoEdadResumen[]
  totalRacimos: number
  racimosRecusados: number
  totalRacimosProcesados: number
  canastillas: number
  kilosCanastillas: number
  referencias: ReferenciaResumen[]
  totalCajas: number
  totalCajas20kg: number
  kilosCajas20kg: number
  pesoNetoRacimo: number | null
  ratio: number | null
  merma: number | null
  transportes: TransporteResumen[]
  notas: string
}

/**
 * Arma el resumen para compartir a partir de un registro ya guardado
 * (usado en Historial), a diferencia del que se arma en Registrar a
 * partir del borrador del formulario.
 */
export function resumenDesdeProduccion(
  r: Produccion,
  opts: { areaTotal: number | null; porcentajeSemana?: number | null } = { areaTotal: null },
): RegistroResumenCompartir {
  const cajas20kgTotal = r.items.reduce((sum, it) => sum + it.cajas_20kg, 0)
  const kilosCajas20kg = cajas20kgTotal * CAJA_20KG_KG
  const kilosCanastillas = r.canastillas * CANASTILLA_KG
  const totalRacimos = SEMANAS_RACIMO.reduce((sum, s) => sum + r[`racimos_semana_${s}` as const], 0)
  const totalRacimosProcesados = totalRacimos - r.racimos_recusados
  const pesoTotal = kilosCajas20kg + kilosCanastillas
  const pesoNetoRacimo = totalRacimos > 0 ? pesoTotal / totalRacimos : null
  const ratio = totalRacimos > 0 ? cajas20kgTotal / totalRacimos : null
  const merma = pesoTotal > 0 ? (kilosCanastillas / pesoTotal) * 100 : null
  const porcentajeDia = opts.areaTotal && r.area_recorrida !== null ? (r.area_recorrida / opts.areaTotal) * 100 : null

  return {
    fecha: r.fecha,
    semana: r.semana,
    finca: r.finca,
    horaFinalizacion: r.hora_finalizacion,
    areaTotal: opts.areaTotal,
    areaRecorrida: r.area_recorrida,
    porcentajeDia,
    porcentajeSemana: opts.porcentajeSemana ?? null,
    racimosPorEdad: SEMANAS_RACIMO.map((s) => ({
      semana: s,
      racimos: r[`racimos_semana_${s}` as const],
      grado: r[`grado_semana_${s}` as const],
    })),
    totalRacimos,
    racimosRecusados: r.racimos_recusados,
    totalRacimosProcesados,
    canastillas: r.canastillas,
    kilosCanastillas,
    referencias: r.items.map((it) => ({
      referencia: it.referencia,
      cajas: it.cantidad_cajas,
      cajas20kg: it.cajas_20kg,
      rechazadas: it.cajas_rechazadas,
    })),
    totalCajas: r.items.reduce((sum, it) => sum + it.cantidad_cajas, 0),
    totalCajas20kg: cajas20kgTotal,
    kilosCajas20kg,
    pesoNetoRacimo,
    ratio,
    merma,
    transportes: r.transportes.map((t) => ({
      tipo: t.tipo,
      placa: t.placa ?? '',
      sello: t.sello ?? '',
      horaLlegada: t.hora_llegada ?? '',
      horaSalida: t.hora_salida ?? '',
    })),
    notas: r.notas ?? '',
  }
}

export function mensajeWhatsapp(r: RegistroResumenCompartir): string {
  const lineas: string[] = []

  lineas.push('*ApproBan – Registro de producción*')
  lineas.push('')
  lineas.push(`Fecha: ${r.fecha} (semana ${r.semana})`)
  lineas.push(`Finca: ${r.finca}`)
  if (r.horaFinalizacion) lineas.push(`Hora finalización: ${r.horaFinalizacion}`)

  if (r.areaRecorrida !== null || r.porcentajeSemana !== null) {
    lineas.push('')
    lineas.push('*Área recorrida*')
    if (r.areaRecorrida !== null) {
      lineas.push(`Hoy: ${r.areaRecorrida} ha${r.porcentajeDia !== null ? ` (${r.porcentajeDia.toFixed(1)}% del área total)` : ''}`)
    }
    if (r.porcentajeSemana !== null) {
      lineas.push(`Acumulado semana ${r.semana}: ${r.porcentajeSemana.toFixed(1)}%`)
    }
  }

  lineas.push('')
  lineas.push('*Racimos por edad*')
  for (const e of r.racimosPorEdad) {
    if (e.racimos > 0 || e.grado !== null) {
      lineas.push(`S${e.semana}: ${e.racimos}${e.grado !== null ? ` (grado ${e.grado})` : ''}`)
    }
  }
  lineas.push(`Total cosechados: ${r.totalRacimos}`)
  lineas.push(`Recusados: ${r.racimosRecusados}`)
  lineas.push(`Procesados: ${r.totalRacimosProcesados}`)

  lineas.push('')
  lineas.push('*Canastillas*')
  lineas.push(`${r.canastillas} (${r.kilosCanastillas.toFixed(2)} kg)`)

  lineas.push('')
  lineas.push('*Referencias producidas*')
  for (const it of r.referencias) {
    const partes = [
      `${it.referencia}: ${it.cajas} cajas`,
      it.cajas20kg !== null ? `${it.cajas20kg.toFixed(2)} cajas 20kg` : null,
      it.rechazadas > 0 ? `${it.rechazadas} rechazadas` : null,
    ].filter(Boolean)
    lineas.push(partes.join(' · '))
  }

  lineas.push('')
  lineas.push('*Totales*')
  lineas.push(`Cajas: ${r.totalCajas}`)
  lineas.push(`Cajas 20kg: ${r.totalCajas20kg.toFixed(2)}`)
  if (r.pesoNetoRacimo !== null) lineas.push(`Peso neto de racimo: ${r.pesoNetoRacimo.toFixed(2)} kg`)
  if (r.ratio !== null) lineas.push(`Ratio: ${r.ratio.toFixed(2)}`)
  if (r.merma !== null) lineas.push(`Merma: ${r.merma.toFixed(1)}%`)

  if (r.transportes.length > 0) {
    lineas.push('')
    lineas.push('*Transporte*')
    for (const t of r.transportes) {
      const horas = t.horaLlegada && t.horaSalida ? `${t.horaLlegada}-${t.horaSalida}` : t.horaLlegada
      lineas.push([t.tipo, t.placa, t.sello, horas].filter(Boolean).join(' · '))
    }
  }

  if (r.notas) {
    lineas.push('')
    lineas.push(`Notas: ${r.notas}`)
  }

  return lineas.join('\n')
}

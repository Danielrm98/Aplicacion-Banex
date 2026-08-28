import { CAJA_20KG_KG, CANASTILLA_KG, SEMANAS_RACIMO, type Produccion } from '../types/produccion'
import { diaSemana } from './diaSemana'

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

  lineas.push('*INFORME DE EXPORTACIÓN*')
  lineas.push(`*FINCA:* ${r.finca}`)
  lineas.push(`*SEMANA:* ${r.semana}`)
  lineas.push(`*DÍA:* ${diaSemana(r.fecha).toUpperCase()}`)
  lineas.push(`*FECHA:* ${r.fecha}`)
  lineas.push(`*FIN CORTE:* ${r.horaFinalizacion ?? ''}`)
  lineas.push(`*CANASTILLAS:* ${r.canastillas}`)

  if (r.areaRecorrida !== null) {
    const total = r.areaTotal !== null ? r.areaTotal : '—'
    const porcentaje = r.porcentajeDia !== null ? `${r.porcentajeDia.toFixed(2)}%` : '—'
    lineas.push(`*ÁREA REC.:* ${r.areaRecorrida} de ${total} :: ${porcentaje}`)
  }

  for (const e of r.racimosPorEdad) {
    if (e.racimos > 0 || e.grado !== null) {
      const edad = String(e.semana).padStart(2, '0')
      lineas.push(`*EDAD ${edad}:* ${e.racimos} RACIMOS${e.grado !== null ? `, A ${e.grado.toFixed(1)}` : ''}`)
    }
  }
  lineas.push(`*TOTAL RACIMOS:* ${r.totalRacimos}`)
  lineas.push(`*RACIMOS RECUSADOS:* ${r.racimosRecusados}`)

  for (const it of r.referencias) {
    const cajas20kg = it.cajas20kg !== null ? ` = ${it.cajas20kg.toFixed(2)} (20K)` : ''
    lineas.push(`*${it.referencia}:* ${it.cajas}${cajas20kg}`)
  }
  lineas.push(`*TOTAL CAJAS:* ${r.totalCajas} = ${r.totalCajas20kg.toFixed(2)} (20K)`)
  if (r.ratio !== null) lineas.push(`*RATIO:* ${r.ratio.toFixed(2)}`)
  if (r.merma !== null) lineas.push(`*MERMA:* ${r.merma.toFixed(2)}%`)

  if (r.transportes.length > 0) {
    lineas.push('*TRANSPORTADOS EN:*')
    const camiones = r.transportes.filter((t) => t.tipo === 'Camión')
    const contenedores = r.transportes.filter((t) => t.tipo === 'Contenedor')
    const otros = r.transportes.filter((t) => t.tipo !== 'Camión' && t.tipo !== 'Contenedor')
    const pares = Math.max(camiones.length, contenedores.length)

    for (let i = 0; i < pares; i++) {
      const camion = camiones[i]
      const contenedor = contenedores[i]
      const partes = [
        camion ? `*CABEZOTE CON PLACA:* ${camion.placa}` : null,
        contenedor ? `*No. CONT.:* ${contenedor.placa}` : null,
      ].filter(Boolean)
      lineas.push(partes.join(' Y '))
      lineas.push(`*SALIENDO A LAS:* ${camion?.horaSalida || contenedor?.horaSalida || ''}`)
    }

    for (const t of otros) {
      lineas.push(`*${t.tipo.toUpperCase()} CON PLACA:* ${t.placa}`)
      lineas.push(`*SALIENDO A LAS:* ${t.horaSalida || ''}`)
    }
  }

  if (r.notas) lineas.push(`*NOTAS:* ${r.notas}`)

  return lineas.join('\n')
}

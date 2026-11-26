// Lee, en el navegador, el mismo Excel "Escalera Nueva.xlsx" que ya se
// importó una vez a mano con scripts/importar-escalera-historico.mjs —
// misma estructura de columnas, pero pensado para volver a correrse cada
// vez que el usuario actualice su Excel, no solo una vez. Solo procesa
// semanas hasta hoy (lo que esté más adelante en el Excel son sus propias
// fórmulas de proyección, no datos reales; la app calcula su propia
// proyección por separado) — se puede volver a subir el mismo archivo
// cuantas veces haga falta, siempre actualiza (upsert), nunca duplica.
import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EDADES_COSECHA, type CosechaPorEdadInput, type EmbolseHistorico } from '../types/escaleraProduccion'

const HOJAS_EXCLUIDAS = new Set(['En Blanco', 'Hoja1', 'BNX', 'BNX CVN', 'BNX ORG', 'Parametros'])
const COL_ANIO_EMB = 2
const COL_SEM_EMB = 3
const COL_HAS = 4
const COL_BELL_HA = 5
const COL_EMB_REAL = 6
const COL_ANIO_COS = 15
const COL_SEM_COS = 16
const COLS_EDAD: Record<(typeof EDADES_COSECHA)[number], number> = { 8: 36, 9: 37, 10: 38, 11: 39, 12: 40 }
const FILA_HEADER = 9
const FILA_INICIO_DATOS = 10

// Para columnas que SÍ pueden venir calculadas (Emb Real en semanas
// todavía abiertas, por ejemplo): acepta tanto un número tecleado como el
// resultado cacheado de una fórmula.
function valorCelda(cell: ExcelJS.Cell): number | null {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v) {
    const resultado = (v as { result?: unknown }).result
    return typeof resultado === 'number' ? resultado : null
  }
  return null
}

// Para las columnas "Datos digitados manualmente" (AJ-AO, racimos por
// edad): SOLO cuenta un número tecleado a mano. Cerca de la semana actual,
// el propio Excel rellena esas celdas con una fórmula que mira filas
// futuras (ej. "=+G1052*F1052") para no dejar el hueco en blanco — eso es
// una estimación interna suya, no un dato real, y no debe importarse como
// si lo fuera.
function valorDigitadoAMano(cell: ExcelJS.Cell): number | null {
  return typeof cell.value === 'number' ? cell.value : null
}

export interface ResultadoFincaImportada {
  hoja: string
  finca: string
  filasEmbolse: EmbolseHistorico[]
  filasCosecha: CosechaPorEdadInput[]
}

export interface ResultadoImportacion {
  porFinca: ResultadoFincaImportada[]
  hojasOmitidas: string[]
  totalEmbolse: number
  totalCosecha: number
}

/**
 * Procesa el libro ya cargado: por cada hoja de finca (salta las de
 * resumen/parámetros y las que no coincidan con ninguna finca del
 * catálogo), extrae el histórico de embolse y de racimos por edad hasta
 * `cutoffAnio`/`cutoffSemana` (normalmente la semana actual — de ahí en
 * adelante son las propias fórmulas de proyección del Excel, no datos
 * reales). No escribe nada en Supabase todavía, solo arma el resultado
 * para mostrarlo de vista previa antes de confirmar.
 */
export function procesarLibroEscalera(
  workbook: ExcelJS.Workbook,
  nombresFincaValidos: Set<string>,
  cutoffAnio: number,
  cutoffSemana: number,
): ResultadoImportacion {
  const porFinca: ResultadoFincaImportada[] = []
  const hojasOmitidas: string[] = []

  for (const sheet of workbook.worksheets) {
    const nombreHoja = sheet.name
    if (HOJAS_EXCLUIDAS.has(nombreHoja)) continue

    const finca = [...nombresFincaValidos].find((f) => f.trim().toLowerCase() === nombreHoja.trim().toLowerCase())
    if (!finca) {
      hojasOmitidas.push(nombreHoja)
      continue
    }

    const headerA = sheet.getRow(FILA_HEADER).getCell(1).value
    if (headerA !== 'ID COS') {
      hojasOmitidas.push(`${nombreHoja} (sin el formato esperado)`)
      continue
    }

    const filasEmbolse: EmbolseHistorico[] = []
    const filasCosecha: CosechaPorEdadInput[] = []

    for (let fila = FILA_INICIO_DATOS; fila <= sheet.rowCount; fila++) {
      const row = sheet.getRow(fila)
      const anioEmb = valorCelda(row.getCell(COL_ANIO_EMB))
      const semEmb = valorCelda(row.getCell(COL_SEM_EMB))
      if (anioEmb === null || semEmb === null) break // fin de los datos de esta hoja

      // Solo hasta la semana actual: de ahí en adelante son las propias
      // fórmulas de proyección del Excel, no datos reales digitados.
      if (anioEmb > cutoffAnio || (anioEmb === cutoffAnio && semEmb > cutoffSemana)) break

      const hectareas = valorCelda(row.getCell(COL_HAS))
      const bellPorHa = valorCelda(row.getCell(COL_BELL_HA))
      const embReal = valorCelda(row.getCell(COL_EMB_REAL))
      if (embReal !== null) {
        filasEmbolse.push({ finca, anio: anioEmb, semana: semEmb, hectareas, bell_por_ha: bellPorHa, emb_real: embReal })
      }

      const anioCos = valorCelda(row.getCell(COL_ANIO_COS))
      const semCos = valorCelda(row.getCell(COL_SEM_COS))
      if (anioCos !== null && semCos !== null) {
        for (const edad of EDADES_COSECHA) {
          const racimos = valorDigitadoAMano(row.getCell(COLS_EDAD[edad]))
          if (racimos === null) continue // no se digitó esa semana/edad, no se inventa un 0
          filasCosecha.push({ finca, anio: anioCos, semana: semCos, edad_semanas: edad, racimos: Math.max(0, racimos) })
        }
      }
    }

    porFinca.push({ hoja: nombreHoja, finca, filasEmbolse, filasCosecha })
  }

  return {
    porFinca,
    hojasOmitidas,
    totalEmbolse: porFinca.reduce((suma, f) => suma + f.filasEmbolse.length, 0),
    totalCosecha: porFinca.reduce((suma, f) => suma + f.filasCosecha.length, 0),
  }
}

export async function leerLibroExcel(file: File): Promise<ExcelJS.Workbook> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

function* enLotes<T>(arr: T[], tamano: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += tamano) yield arr.slice(i, i + tamano)
}

/**
 * Escribe en Supabase lo que ya se procesó (upsert por finca/año/semana —
 * nunca duplica, siempre actualiza). Usa la sesión del propio administrador
 * que lo sube, no una service role key.
 */
export async function guardarImportacionEscalera(
  supabase: SupabaseClient,
  resultado: ResultadoImportacion,
  userId: string,
  onProgreso?: (mensaje: string) => void,
): Promise<void> {
  for (const f of resultado.porFinca) {
    if (f.filasEmbolse.length > 0) {
      onProgreso?.(`${f.finca}: guardando ${f.filasEmbolse.length} semanas de embolse...`)
      for (const lote of enLotes(f.filasEmbolse, 500)) {
        const { error } = await supabase.from('escalera_embolse_historico').upsert(lote, { onConflict: 'finca,anio,semana' })
        if (error) throw new Error(`escalera_embolse_historico (${f.finca}): ${error.message}`)
      }
    }
    if (f.filasCosecha.length > 0) {
      onProgreso?.(`${f.finca}: guardando ${f.filasCosecha.length} filas de cosecha por edad...`)
      const filasConUsuario = f.filasCosecha.map((fila) => ({ ...fila, user_id: userId }))
      for (const lote of enLotes(filasConUsuario, 500)) {
        const { error } = await supabase.from('cosecha_por_edad').upsert(lote, { onConflict: 'finca,anio,semana,edad_semanas' })
        if (error) throw new Error(`cosecha_por_edad (${f.finca}): ${error.message}`)
      }
    }
  }
}

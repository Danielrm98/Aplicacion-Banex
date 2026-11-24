// Importa, UNA SOLA VEZ, el histórico de la "escalera de producción" desde
// el Excel (Escalera Nueva.xlsx) hacia Supabase:
//   - escalera_embolse_historico: embolse real por finca/semana, de ANTES
//     de que "Registro de embolse" existiera en la app.
//   - cosecha_por_edad: racimos cosechados por edad (8-13 semanas), para
//     las semanas de cosecha correspondientes a ese mismo histórico.
//
// No toca nada más del Excel ni de la app; se puede correr varias veces
// sin duplicar nada (usa upsert con las mismas llaves únicas de las tablas).
//
// Uso:
//   node scripts/importar-escalera-historico.mjs \
//     --file "C:\ruta\a\Escalera Nueva.xlsx" \
//     --user-id <uuid de un admin ya existente en auth.users> \
//     [--cutoff-anio 2026] [--cutoff-semana 39] \
//     [--fincas "Tropicana,Macondo"] \
//     [--dry-run]
//
// Variables de entorno requeridas (no se piden por línea de comandos para
// no dejarlas en el historial de la terminal):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// El --dry-run no escribe nada: solo imprime cuántas filas importaría por
// finca, para comparar a mano contra el Excel antes de correrlo de verdad.

import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

const HOJAS_EXCLUIDAS = new Set(['En Blanco', 'Hoja1', 'BNX', 'BNX CVN', 'BNX ORG', 'Parametros'])
const COL_ANIO_EMB = 2
const COL_SEM_EMB = 3
const COL_HAS = 4
const COL_BELL_HA = 5
const COL_EMB_REAL = 6
const COL_ANIO_COS = 15
const COL_SEM_COS = 16
const COLS_EDAD = { 8: 36, 9: 37, 10: 38, 11: 39, 12: 40, 13: 41 }
const FILA_HEADER = 9
const FILA_INICIO_DATOS = 10

function argValor(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : porDefecto
}
function argFlag(nombre) {
  return process.argv.includes(`--${nombre}`)
}

function valorCelda(cell) {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v) return typeof v.result === 'number' ? v.result : null
  return null
}

async function main() {
  const archivo = argValor('file')
  const userId = argValor('user-id')
  const cutoffAnio = Number(argValor('cutoff-anio', '2026'))
  const cutoffSemana = Number(argValor('cutoff-semana', '39'))
  const fincasFiltro = argValor('fincas')
  const soloFincas = fincasFiltro ? new Set(fincasFiltro.split(',').map((f) => f.trim().toLowerCase())) : null
  const dryRun = argFlag('dry-run')

  if (!archivo) {
    console.error('Falta --file "ruta al Escalera Nueva.xlsx"')
    process.exit(1)
  }
  if (!userId) {
    console.error('Falta --user-id <uuid>: un usuario admin ya existente (los registros históricos necesitan un dueño).')
    process.exit(1)
  }
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`Leyendo "${archivo}"...`)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(archivo)

  const { data: fincasDb, error: fincasError } = await supabase.from('fincas').select('nombre')
  if (fincasError) {
    console.error('No se pudo leer la tabla fincas:', fincasError.message)
    process.exit(1)
  }
  const fincasPorNombreLower = new Map(fincasDb.map((f) => [f.nombre.trim().toLowerCase(), f.nombre]))

  let totalEmbolseHistorico = 0
  let totalCosechaEdad = 0
  let hojasOmitidas = []

  for (const sheet of workbook.worksheets) {
    const nombreHoja = sheet.name
    if (HOJAS_EXCLUIDAS.has(nombreHoja)) continue
    if (soloFincas && !soloFincas.has(nombreHoja.trim().toLowerCase())) continue

    const nombreFinca = fincasPorNombreLower.get(nombreHoja.trim().toLowerCase())
    if (!nombreFinca) {
      hojasOmitidas.push(nombreHoja)
      continue
    }

    const headerA = sheet.getRow(FILA_HEADER).getCell(1).value
    if (headerA !== 'ID COS') {
      console.warn(`"${nombreHoja}": la fila ${FILA_HEADER} no tiene el encabezado esperado ("ID COS"), se omite.`)
      continue
    }

    const filasEmbolse = []
    const filasCosecha = []

    for (let fila = FILA_INICIO_DATOS; fila <= sheet.rowCount; fila++) {
      const row = sheet.getRow(fila)
      const anioEmb = valorCelda(row.getCell(COL_ANIO_EMB))
      const semEmb = valorCelda(row.getCell(COL_SEM_EMB))
      if (anioEmb === null || semEmb === null) break // fin de los datos de esta hoja

      // Solo lo anterior al arranque real de "Registro de embolse" en la
      // app: de ahí en adelante, el embolse real ya vive en la tabla
      // `embolses`, no hace falta duplicarlo aquí.
      if (anioEmb > cutoffAnio || (anioEmb === cutoffAnio && semEmb >= cutoffSemana)) break

      const hectareas = valorCelda(row.getCell(COL_HAS))
      const bellPorHa = valorCelda(row.getCell(COL_BELL_HA))
      const embReal = valorCelda(row.getCell(COL_EMB_REAL))
      if (embReal !== null) {
        filasEmbolse.push({
          finca: nombreFinca,
          anio: anioEmb,
          semana: semEmb,
          hectareas,
          bell_por_ha: bellPorHa,
          emb_real: embReal,
        })
      }

      const anioCos = valorCelda(row.getCell(COL_ANIO_COS))
      const semCos = valorCelda(row.getCell(COL_SEM_COS))
      if (anioCos !== null && semCos !== null) {
        for (const [edad, col] of Object.entries(COLS_EDAD)) {
          const racimos = valorCelda(row.getCell(col))
          if (racimos === null) continue // no se digitó esa semana/edad, no se inventa un 0
          filasCosecha.push({
            finca: nombreFinca,
            anio: anioCos,
            semana: semCos,
            edad_semanas: Number(edad),
            // En la fila de transición real/proyectado, la fórmula de %12
            // puede dar un residuo negativo cercanísimo a 0 (ej. -0.44) por
            // puro redondeo; no es una corrección real, se deja en 0.
            racimos: Math.max(0, racimos),
            user_id: userId,
          })
        }
      }
    }

    console.log(`${nombreFinca}: ${filasEmbolse.length} semanas de embolse histórico, ${filasCosecha.length} filas de cosecha por edad.`)
    totalEmbolseHistorico += filasEmbolse.length
    totalCosechaEdad += filasCosecha.length

    if (dryRun) continue

    for (const lote of enLotes(filasEmbolse, 500)) {
      const { error } = await supabase.from('escalera_embolse_historico').upsert(lote, { onConflict: 'finca,anio,semana' })
      if (error) throw new Error(`escalera_embolse_historico (${nombreFinca}): ${error.message}`)
    }
    for (const lote of enLotes(filasCosecha, 500)) {
      const { error } = await supabase.from('cosecha_por_edad').upsert(lote, { onConflict: 'finca,anio,semana,edad_semanas' })
      if (error) throw new Error(`cosecha_por_edad (${nombreFinca}): ${error.message}`)
    }
  }

  if (hojasOmitidas.length > 0) {
    console.warn(`\nHojas sin finca correspondiente en la tabla "fincas" (se omitieron): ${hojasOmitidas.join(', ')}`)
  }
  console.log(`\nTotal: ${totalEmbolseHistorico} semanas de embolse histórico, ${totalCosechaEdad} filas de cosecha por edad.`)
  if (dryRun) console.log('(dry-run: no se escribió nada en Supabase)')
}

function* enLotes(arr, tamano) {
  for (let i = 0; i < arr.length; i += tamano) yield arr.slice(i, i + tamano)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

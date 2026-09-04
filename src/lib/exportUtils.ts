import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FilaCompleta, FilaProduccion, ResumenDiaFinca } from './aggregations'

const columns: { header: string; key: keyof FilaProduccion; width?: number }[] = [
  { header: 'Fecha', key: 'fecha', width: 14 },
  { header: 'Semana', key: 'semana', width: 10 },
  { header: 'Finca', key: 'finca', width: 24 },
  { header: 'Referencia', key: 'referencia', width: 20 },
  { header: 'Peso neto (kg)', key: 'peso_neto_kg', width: 16 },
  { header: 'Cajas', key: 'cantidad_cajas', width: 10 },
  { header: 'Cajas 20kg', key: 'cajas_20kg', width: 12 },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportToExcel(filas: FilaProduccion[], filename = 'produccion_banano.xlsx') {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Producción')

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key as string, width: c.width }))
  sheet.getRow(1).font = { bold: true }

  for (const f of filas) {
    sheet.addRow(f)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), filename)
}

const columnasCompletas: { header: string; key: keyof FilaCompleta; width?: number }[] = [
  { header: 'Fecha', key: 'fecha', width: 14 },
  { header: 'Día', key: 'dia', width: 12 },
  { header: 'Semana', key: 'semana', width: 10 },
  { header: 'Finca', key: 'finca', width: 22 },
  { header: 'Hora finalización', key: 'horaFinalizacion', width: 14 },
  { header: 'Referencia', key: 'referencia', width: 18 },
  { header: 'Cajas', key: 'cantidadCajas', width: 10 },
  { header: 'Peso neto (kg)', key: 'pesoNetoKg', width: 14 },
  { header: 'Cajas 20kg', key: 'cajas20kg', width: 12 },
  { header: 'Racimos cosechados', key: 'racimosCosechados', width: 16 },
  { header: 'Racimos recusados', key: 'racimosRecusados', width: 16 },
  { header: 'Racimos procesados', key: 'racimosProcesados', width: 16 },
  { header: 'Canastillas', key: 'canastillas', width: 12 },
  { header: 'Kilos canastillas', key: 'kilosCanastillas', width: 16 },
  { header: 'Peso neto racimo (kg)', key: 'pesoNetoRacimo', width: 18 },
  { header: 'Ratio', key: 'ratio', width: 10 },
  { header: 'Merma (%)', key: 'merma', width: 12 },
  { header: 'Transporte', key: 'transporte', width: 30 },
  { header: 'Notas', key: 'notas', width: 24 },
]

const columnasResumen: { header: string; key: keyof ResumenDiaFinca; width?: number }[] = [
  { header: 'Fecha', key: 'fecha', width: 14 },
  { header: 'Día', key: 'dia', width: 12 },
  { header: 'Semana', key: 'semana', width: 10 },
  { header: 'Finca', key: 'finca', width: 22 },
  { header: 'Hora finalización', key: 'horaFinalizacion', width: 14 },
  { header: 'Racimos S7', key: 'racimosSemana7', width: 12 },
  { header: 'Racimos S8', key: 'racimosSemana8', width: 12 },
  { header: 'Racimos S9', key: 'racimosSemana9', width: 12 },
  { header: 'Racimos S10', key: 'racimosSemana10', width: 12 },
  { header: 'Racimos S11', key: 'racimosSemana11', width: 12 },
  { header: 'Racimos S12', key: 'racimosSemana12', width: 12 },
  { header: 'Racimos cosechados', key: 'racimosCosechados', width: 16 },
  { header: 'Racimos recusados', key: 'racimosRecusados', width: 16 },
  { header: 'Racimos procesados', key: 'racimosProcesados', width: 16 },
  { header: 'Calibración promedio', key: 'gradoPromedio', width: 18 },
  { header: 'Canastillas', key: 'canastillas', width: 12 },
  { header: 'Kilos canastillas', key: 'kilosCanastillas', width: 16 },
  { header: 'Peso neto racimo (kg)', key: 'pesoNetoRacimo', width: 18 },
  { header: 'Ratio', key: 'ratio', width: 10 },
  { header: 'Merma (%)', key: 'merma', width: 12 },
  { header: 'Transporte', key: 'transporte', width: 30 },
  { header: 'Notas', key: 'notas', width: 24 },
]

export async function exportFilaCompletaToExcel(
  filas: FilaCompleta[],
  resumenes: ResumenDiaFinca[],
  filename = 'reportes_banano.xlsx',
) {
  // Del más reciente al más antiguo, sin depender del orden en que hayan
  // llegado los datos.
  const resumenesOrdenados = [...resumenes].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const filasOrdenadas = [...filas].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const workbook = new ExcelJS.Workbook()

  const sheetResumen = workbook.addWorksheet('Resumen por día y finca')
  sheetResumen.columns = columnasResumen.map((c) => ({ header: c.header, key: c.key as string, width: c.width }))
  sheetResumen.getRow(1).font = { bold: true }
  for (const r of resumenesOrdenados) {
    sheetResumen.addRow({
      ...r,
      ratio: r.ratio !== null ? Number(r.ratio.toFixed(2)) : '',
      merma: r.merma !== null ? Number(r.merma.toFixed(1)) : '',
      pesoNetoRacimo: r.pesoNetoRacimo !== null ? Number(r.pesoNetoRacimo.toFixed(2)) : '',
      gradoPromedio: r.gradoPromedio !== null ? Number(r.gradoPromedio.toFixed(1)) : '',
    })
  }

  const sheet = workbook.addWorksheet('Reportes')
  sheet.columns = columnasCompletas.map((c) => ({ header: c.header, key: c.key as string, width: c.width }))
  sheet.getRow(1).font = { bold: true }

  for (const f of filasOrdenadas) {
    sheet.addRow({
      ...f,
      ratio: f.ratio !== null ? Number(f.ratio.toFixed(2)) : '',
      merma: f.merma !== null ? Number(f.merma.toFixed(1)) : '',
      pesoNetoRacimo: f.pesoNetoRacimo !== null ? Number(f.pesoNetoRacimo.toFixed(2)) : '',
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), filename)
}

export function exportToPdf(filas: FilaProduccion[], filename = 'produccion_banano.pdf') {
  const filasOrdenadas = [...filas].sort((a, b) => b.fecha.localeCompare(a.fecha))

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Producción de cajas de banano', 14, 15)

  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body: filasOrdenadas.map((f) => columns.map((c) => String(f[c.key] ?? ''))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [21, 128, 61] },
  })

  doc.save(filename)
}

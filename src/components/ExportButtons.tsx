import { useMemo, useState } from 'react'
import { exportFilaCompletaToExcel, exportToPdf } from '../lib/exportUtils'
import { filaCompleta, flattenItems } from '../lib/aggregations'
import type { Produccion } from '../types/produccion'

export default function ExportButtons({ registros }: { registros: Produccion[] }) {
  const [exporting, setExporting] = useState(false)
  const disabled = exporting || registros.length === 0

  const filasCompletas = useMemo(() => filaCompleta(registros), [registros])
  const filas = useMemo(() => flattenItems(registros), [registros])

  async function handleExcel() {
    setExporting(true)
    try {
      await exportFilaCompletaToExcel(filasCompletas)
    } finally {
      setExporting(false)
    }
  }

  function handlePdf() {
    exportToPdf(filas)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExcel}
        disabled={disabled}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Exportar Excel
      </button>
      <button
        onClick={handlePdf}
        disabled={disabled}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Exportar PDF
      </button>
    </div>
  )
}

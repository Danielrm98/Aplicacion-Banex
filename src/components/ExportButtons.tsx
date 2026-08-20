import { useState } from 'react'
import { exportToExcel, exportToPdf } from '../lib/exportUtils'
import type { FilaProduccion } from '../lib/aggregations'

export default function ExportButtons({ filas }: { filas: FilaProduccion[] }) {
  const [exporting, setExporting] = useState(false)
  const disabled = exporting || filas.length === 0

  async function handleExcel() {
    setExporting(true)
    try {
      await exportToExcel(filas)
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

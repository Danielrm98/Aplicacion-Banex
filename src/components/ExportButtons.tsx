import { useMemo, useState } from 'react'
import { exportFilaCompletaToExcel, exportToPdf } from '../lib/exportUtils'
import { filaCompleta, flattenItems, resumenPorDiaFinca } from '../lib/aggregations'
import { useVentasCanastillas } from '../lib/useVentasCanastillas'
import type { Produccion } from '../types/produccion'

export default function ExportButtons({ registros }: { registros: Produccion[] }) {
  const [exporting, setExporting] = useState(false)
  const disabled = exporting || registros.length === 0

  const { ventas } = useVentasCanastillas({})

  const filasCompletas = useMemo(() => filaCompleta(registros), [registros])
  const resumenes = useMemo(() => resumenPorDiaFinca(registros), [registros])
  const filas = useMemo(() => flattenItems(registros), [registros])

  async function handleExcel() {
    setExporting(true)
    try {
      await exportFilaCompletaToExcel(filasCompletas, resumenes, registros, ventas)
    } finally {
      setExporting(false)
    }
  }

  function handlePdf() {
    exportToPdf(filas)
  }

  const claseBoton =
    'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-700'

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={handleExcel} disabled={disabled} className={claseBoton}>
        Exportar Excel
      </button>
      <button onClick={handlePdf} disabled={disabled} className={claseBoton}>
        Exportar PDF
      </button>
    </div>
  )
}

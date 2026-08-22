import SingleLineChart from './SingleLineChart'
import { chartColors } from './chartTheme'
import type { SerieFincaSemana } from '../../lib/aggregations'

export default function CajasPorFincaSemanaChart({ data }: { data: SerieFincaSemana[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-gray-500">Sin datos para graficar.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((serie) => (
        <div key={serie.finca} className="rounded-lg border border-gray-100 p-2">
          <div className="mb-1 flex items-baseline justify-between px-1">
            <span className="truncate text-xs font-semibold text-gray-700">{serie.finca}</span>
            <span className="shrink-0 text-xs font-semibold" style={{ color: chartColors.blue }}>
              {serie.total.toLocaleString('es')}
            </span>
          </div>
          <SingleLineChart
            data={serie.puntos}
            xKey="semana"
            yKey="cajas"
            seriesName="cajas"
            xLabelFormatter={(v) => `S${v}`}
            height={110}
            compact
          />
        </div>
      ))}
    </div>
  )
}

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartColors } from './chartTheme'

export interface PuntoRatioSemana {
  semana: number
  ratioPremio: number | null
  ratioTotal: number | null
  ratioPotencial: number | null
}

const SERIES = [
  { key: 'ratioPremio', nombre: 'Ratio premio', color: chartColors.blue },
  { key: 'ratioTotal', nombre: 'Ratio total', color: chartColors.orange },
  { key: 'ratioPotencial', nombre: 'Ratio potencial', color: chartColors.aqua },
] as const

function TooltipRatios({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string | number
  payload?: { dataKey?: string | number; value?: number; color?: string; name?: string }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-sm" style={{ background: chartColors.surface, borderColor: chartColors.gridline }}>
      <div style={{ color: chartColors.secondaryText }}>Semana {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="mt-0.5 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color }} aria-hidden />
          <span className="font-semibold" style={{ color: chartColors.primaryText }}>
            {p.value !== undefined ? p.value.toLocaleString('es', { maximumFractionDigits: 2 }) : '—'}
          </span>
          <span style={{ color: chartColors.mutedText }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function RatiosPorSemanaChart({ data }: { data: PuntoRatioSemana[] }) {
  const hayDatos = data.some((d) => d.ratioPremio !== null || d.ratioTotal !== null || d.ratioPotencial !== null)
  if (!hayDatos) return <p className="py-16 text-center text-sm text-gray-500">Sin datos para graficar.</p>

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="semana"
          tickFormatter={(v) => `S${v}`}
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: chartColors.mutedText }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<TooltipRatios />} />
        <Legend wrapperStyle={{ fontSize: 11, color: chartColors.secondaryText }} />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.nombre}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, stroke: chartColors.surface, strokeWidth: 2 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

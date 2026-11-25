import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartColors } from './chartTheme'

export interface PuntoEmbolseSemana {
  semana: number
  [anio: string]: number | null
}

export interface SerieAnio {
  anio: number
  color: string
}

// Mismo orden categórico validado que ya usa RatiosPorSemanaChart (azul,
// naranja, aqua) — se asigna por posición (año más reciente primero), no
// se cicla.
const COLORES_ORDEN = [chartColors.blue, chartColors.orange, chartColors.aqua]

export function coloresPorAnio(anios: number[]): SerieAnio[] {
  return [...anios].sort((a, b) => b - a).map((anio, i) => ({ anio, color: COLORES_ORDEN[i % COLORES_ORDEN.length] }))
}

function TooltipEmbolse({
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
            {p.value !== undefined ? p.value.toLocaleString('es', { maximumFractionDigits: 1 }) : '—'}
          </span>
          <span style={{ color: chartColors.mutedText }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function EmbolsePorSemanaChart({ data, series }: { data: PuntoEmbolseSemana[]; series: SerieAnio[] }) {
  const hayDatos = data.some((d) => series.some((s) => d[String(s.anio)] !== null && d[String(s.anio)] !== undefined))
  if (!hayDatos) return <p className="py-16 text-center text-sm text-gray-500">Sin historial suficiente para graficar.</p>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="semana"
          tickFormatter={(v) => `S${v}`}
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: chartColors.mutedText }} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<TooltipEmbolse />} />
        <Legend wrapperStyle={{ fontSize: 11, color: chartColors.secondaryText }} />
        {series.map((s) => (
          <Line
            key={s.anio}
            type="monotone"
            dataKey={String(s.anio)}
            name={String(s.anio)}
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

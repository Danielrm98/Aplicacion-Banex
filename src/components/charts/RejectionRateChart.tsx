import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PuntoFecha } from '../../lib/aggregations'
import { chartColors } from './chartTheme'
import ChartTooltip from './ChartTooltip'

export default function RejectionRateChart({ data }: { data: PuntoFecha[] }) {
  if (data.length === 0) return <p className="py-16 text-center text-sm text-gray-500">Sin datos para graficar.</p>

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={false}
          tickLine={false}
          width={40}
          unit="%"
        />
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label}
              value={payload?.[0]?.value as number | undefined}
              seriesName="tasa de rechazo"
              color={chartColors.orange}
              formatter={(v) => `${v.toFixed(1)}%`}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="tasaRechazo"
          name="Tasa de rechazo"
          stroke={chartColors.orange}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColors.orange, stroke: chartColors.surface, strokeWidth: 2 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

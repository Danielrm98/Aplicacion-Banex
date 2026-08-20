import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PuntoFinca } from '../../lib/aggregations'
import { chartColors } from './chartTheme'
import ChartTooltip from './ChartTooltip'

interface Props {
  data: PuntoFinca[]
  seriesName?: string
  barName?: string
  color?: string
}

export default function ProductionByFarmChart({
  data,
  seriesName = 'cajas',
  barName = 'Cajas producidas',
  color = chartColors.blue,
}: Props) {
  if (data.length === 0) return <p className="py-16 text-center text-sm text-gray-500">Sin datos para graficar.</p>

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="finca"
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: chartColors.gridline, opacity: 0.4 }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label}
              value={payload?.[0]?.value as number | undefined}
              seriesName={seriesName}
              color={color}
              formatter={(v) => v.toLocaleString('es')}
            />
          )}
        />
        <Bar dataKey="cajas" name={barName} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

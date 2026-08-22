import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartColors } from './chartTheme'
import ChartTooltip from './ChartTooltip'

interface Props<T> {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  color?: string
  seriesName: string
  xLabelFormatter?: (v: number) => string
  valueFormatter?: (v: number) => string
  height?: number
  compact?: boolean
}

export default function SingleLineChart<T extends object>({
  data,
  xKey,
  yKey,
  color = chartColors.blue,
  seriesName,
  xLabelFormatter,
  valueFormatter = (v) => v.toLocaleString('es'),
  height = 260,
  compact = false,
}: Props<T>) {
  const hayDatos = data.some((d) => d[yKey] !== null && d[yKey] !== undefined)
  if (!hayDatos) return <p className="py-16 text-center text-sm text-gray-500">Sin datos para graficar.</p>

  const chartData = data as unknown as Record<string, number | null>[]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey={xKey as string}
          tickFormatter={xLabelFormatter}
          tick={{ fontSize: compact ? 9 : 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
          interval={compact ? 'preserveStartEnd' : 0}
        />
        {!compact && (
          <YAxis tick={{ fontSize: 11, fill: chartColors.mutedText }} axisLine={false} tickLine={false} width={44} />
        )}
        <Tooltip
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={xLabelFormatter ? xLabelFormatter(Number(label)) : label}
              value={payload?.[0]?.value as number | undefined}
              seriesName={seriesName}
              color={color}
              formatter={valueFormatter}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          name={seriesName}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color, stroke: chartColors.surface, strokeWidth: 2 }}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

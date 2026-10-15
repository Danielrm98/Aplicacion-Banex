import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartColors } from './chartTheme'
import ChartTooltip from './ChartTooltip'

function formatoCorto(fechaIso: string): string {
  const [, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}`
}

export default function LluviaRegistradaChart({ data }: { data: { fecha: string; milimetros: number }[] }) {
  if (data.length === 0) return <p className="py-6 text-center text-xs text-gray-400">Sin registros de lluvia todavía.</p>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="fecha"
          tickFormatter={formatoCorto}
          tick={{ fontSize: 10, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10, fill: chartColors.mutedText }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          cursor={{ fill: chartColors.gridline, opacity: 0.4 }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={typeof label === 'string' ? formatoCorto(label) : ''}
              value={payload?.[0]?.value as number | undefined}
              seriesName="mm reportados"
              formatter={(v) => `${v.toFixed(1)} mm`}
            />
          )}
        />
        <Bar dataKey="milimetros" name="Lluvia" fill={chartColors.blue} radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

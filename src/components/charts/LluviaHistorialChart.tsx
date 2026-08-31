import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LluviaHistorialConFuente } from '../../lib/useLluviaReportada'
import { chartColors } from './chartTheme'
import ChartTooltip from './ChartTooltip'

const COLOR_REPORTADO = chartColors.blue
const COLOR_ESTIMADO = '#b8cbe8'

function formatoCorto(fechaIso: string): string {
  const [, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}`
}

export default function LluviaHistorialChart({ data }: { data: LluviaHistorialConFuente[] }) {
  if (data.length === 0) return <p className="py-6 text-center text-xs text-gray-400">Sin historial de lluvia todavía.</p>

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chartColors.gridline} />
          <XAxis
            dataKey="fecha"
            tickFormatter={formatoCorto}
            tick={{ fontSize: 9, fill: chartColors.mutedText }}
            axisLine={{ stroke: chartColors.axis }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 9, fill: chartColors.mutedText }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            cursor={{ fill: chartColors.gridline, opacity: 0.4 }}
            content={({ active, label, payload }) => {
              const punto = payload?.[0]?.payload as LluviaHistorialConFuente | undefined
              return (
                <ChartTooltip
                  active={active}
                  label={typeof label === 'string' ? formatoCorto(label) : ''}
                  value={punto?.mm}
                  seriesName={punto?.fuente === 'reportado' ? 'mm reportados en finca' : 'mm estimados (pronóstico)'}
                  color={punto?.fuente === 'reportado' ? COLOR_REPORTADO : COLOR_ESTIMADO}
                  formatter={(v) => `${v.toFixed(1)} mm`}
                />
              )
            }}
          />
          <Bar dataKey="mm" name="Lluvia" radius={[3, 3, 0, 0]} maxBarSize={16}>
            {data.map((d) => (
              <Cell key={d.fecha} fill={d.fuente === 'reportado' ? COLOR_REPORTADO : COLOR_ESTIMADO} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_REPORTADO }} /> Reportado en
          finca
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_ESTIMADO }} /> Estimado
          (pronóstico)
        </span>
      </div>
    </div>
  )
}

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartColors } from './chartTheme'

export interface PuntoMermaGrupo {
  grupo: string
  porcentajeMerma: number
  mermaDeFinca: number
}

function formatoPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function EtiquetaBarra(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x, y, width, value } = props
  if (x === undefined || y === undefined || width === undefined || value === undefined) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={chartColors.primaryText}>
      {formatoPct(value)}
    </text>
  )
}

function EtiquetaLinea(props: { x?: number; y?: number; value?: number }) {
  const { x, y, value } = props
  if (x === undefined || y === undefined || value === undefined) return null
  return (
    <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill={chartColors.orange}>
      {formatoPct(value)}
    </text>
  )
}

function TooltipMermaGrupo({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: string
  payload?: { value?: number }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const porcentajeMerma = payload[0]?.value
  const mermaDeFinca = payload[1]?.value

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{ background: chartColors.surface, borderColor: chartColors.gridline }}
    >
      <div style={{ color: chartColors.secondaryText }}>{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: chartColors.blue }} aria-hidden />
        <span className="font-semibold" style={{ color: chartColors.primaryText }}>
          {porcentajeMerma !== undefined ? formatoPct(porcentajeMerma) : '—'}
        </span>
        <span style={{ color: chartColors.mutedText }}>% merma (del total evaluado)</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3 rounded" style={{ background: chartColors.orange }} aria-hidden />
        <span className="font-semibold" style={{ color: chartColors.primaryText }}>
          {mermaDeFinca !== undefined ? formatoPct(mermaDeFinca) : '—'}
        </span>
        <span style={{ color: chartColors.mutedText }}>% merma de finca</span>
      </div>
    </div>
  )
}

/** Compara, por grupo, qué tanto pesa cada uno dentro de lo evaluado (barras)
 * contra qué tanto representa dentro de la merma real de la finca (línea) —
 * ambas series ya vienen en el mismo eje (%), ordenadas de mayor a menor
 * según el % de merma para que el grupo que más defectos aporta quede primero. */
export default function MermaGrupoChart({ data }: { data: PuntoMermaGrupo[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-gray-400">Registra cantidades para ver la gráfica.</p>
  }

  const ordenados = [...data].sort((a, b) => b.porcentajeMerma - a.porcentajeMerma)
  const maximo = Math.max(100, ...ordenados.map((d) => Math.max(d.porcentajeMerma, d.mermaDeFinca)))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={ordenados} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="grupo"
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
        />
        <YAxis
          domain={[0, Math.ceil(maximo / 10) * 10]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: chartColors.mutedText }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<TooltipMermaGrupo />} cursor={{ fill: chartColors.gridline, opacity: 0.4 }} />
        <Legend
          formatter={(value) => <span style={{ color: chartColors.secondaryText, fontSize: 12 }}>{value}</span>}
          iconType="square"
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="porcentajeMerma"
          name="% merma (del total evaluado)"
          fill={chartColors.blue}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
          label={<EtiquetaBarra />}
        />
        <Line
          dataKey="mermaDeFinca"
          name="% merma de finca"
          type="monotone"
          stroke={chartColors.orange}
          strokeWidth={2}
          dot={{ r: 4, fill: chartColors.orange, stroke: chartColors.surface, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          label={<EtiquetaLinea />}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

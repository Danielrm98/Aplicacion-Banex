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

// Un solo bloque de 2 líneas por barra (en vez de una etiqueta junto a la
// barra y otra junto al punto de la línea, que terminaban encimándose
// cuando ambos valores eran chicos): así los dos números de un mismo grupo
// siempre quedan juntos y nunca se cruzan con la línea ni entre ellos.
//
// Recharts no reenvía el "payload" completo del punto a un label custom de
// <Bar> (solo x/y/width/value, que sí son propiedades de SVG), así que acá
// se busca el resto del dato por índice en la lista ordenada, pasada como
// prop propio ("datos") que Recharts no toca al clonar el elemento.
function EtiquetaCombinada(props: { x?: number; y?: number; width?: number; index?: number; datos?: PuntoMermaGrupo[] }) {
  const { x, y, width, index, datos } = props
  if (x === undefined || y === undefined || width === undefined || index === undefined || !datos) return null
  const punto = datos[index]
  if (!punto) return null
  const cx = x + width / 2
  return (
    <g>
      <text x={cx} y={y - 21} textAnchor="middle" fontSize={11} fontWeight={700} fill={chartColors.blue}>
        {formatoPct(punto.porcentajeMerma)}
      </text>
      <text x={cx} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={chartColors.orange}>
        {formatoPct(punto.mermaDeFinca)}
      </text>
    </g>
  )
}

// Nombres de grupo horizontales pero chicos: con 6 grupos y el ancho fijo
// de la tarjeta, el nombre más largo (ENFERMEDAD) no cabe al tamaño normal
// de los demás ejes, así que esta etiqueta va un poco más pequeña.
function TickGrupo(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x, y, payload } = props
  if (x === undefined || y === undefined || !payload) return null
  return (
    <text x={x} y={y} dy={11} textAnchor="middle" fontSize={6.8} fill={chartColors.mutedText}>
      {payload.value}
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
  // Sin piso artificial de 100%: si el grupo más grande pesa, por ejemplo,
  // 58%, el eje llega hasta 60% (no hasta 100%) para que las barras chicas
  // no queden aplastadas contra el eje con su etiqueta sin espacio.
  const maximo = Math.max(10, ...ordenados.map((d) => Math.max(d.porcentajeMerma, d.mermaDeFinca)))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={ordenados} margin={{ top: 34, right: 16, left: 0, bottom: 2 }}>
        <CartesianGrid vertical={false} stroke={chartColors.gridline} />
        <XAxis
          dataKey="grupo"
          tick={<TickGrupo />}
          axisLine={{ stroke: chartColors.axis }}
          tickLine={false}
          interval={0}
          padding={{ left: 4, right: 4 }}
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
          label={<EtiquetaCombinada datos={ordenados} />}
        />
        <Line
          dataKey="mermaDeFinca"
          name="% merma de finca"
          type="monotone"
          stroke={chartColors.orange}
          strokeWidth={2}
          dot={{ r: 4, fill: chartColors.orange, stroke: chartColors.surface, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

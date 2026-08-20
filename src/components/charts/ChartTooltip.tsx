import { chartColors } from './chartTheme'

interface Props {
  active?: boolean
  label?: string | number
  formatter: (value: number) => string
  seriesName: string
  value?: number
  color?: string
}

export default function ChartTooltip({ active, label, formatter, seriesName, value, color = chartColors.blue }: Props) {
  if (!active || value === undefined) return null

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{ background: chartColors.surface, borderColor: chartColors.gridline }}
    >
      <div style={{ color: chartColors.secondaryText }}>{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className="inline-block h-0.5 w-3 rounded"
          style={{ background: color }}
          aria-hidden
        />
        <span className="font-semibold" style={{ color: chartColors.primaryText }}>
          {formatter(value)}
        </span>
        <span style={{ color: chartColors.mutedText }}>{seriesName}</span>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

export default function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 transition-shadow hover:shadow-md">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-banex-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

import type { ReactNode } from 'react'

export default function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-banex-800">
      <span className="h-3.5 w-1 shrink-0 rounded-full bg-banana-500" />
      {children}
    </h2>
  )
}

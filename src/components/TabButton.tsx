import type { ReactNode } from 'react'

export default function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'border-banex-600 text-banex-700' : 'border-transparent text-gray-500 hover:border-banex-200 hover:text-banex-600'
      }`}
    >
      {children}
    </button>
  )
}

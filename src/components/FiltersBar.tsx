import { FINCAS } from '../lib/fincas'
import type { Filtros } from '../lib/useProducciones'

interface Props {
  filtros: Filtros
  onChange: (filtros: Filtros) => void
}

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function FiltersBar({ filtros, onChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Semana</span>
        <select
          value={filtros.semana ?? ''}
          onChange={(e) => onChange({ ...filtros, semana: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        >
          <option value="">Todas las semanas</option>
          {SEMANAS.map((semana) => (
            <option key={semana} value={semana}>
              Semana {semana}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Día de proceso</span>
        <input
          type="date"
          value={filtros.fecha ?? ''}
          onChange={(e) => onChange({ ...filtros, fecha: e.target.value || undefined })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Finca</span>
        <select
          value={filtros.finca ?? ''}
          onChange={(e) => onChange({ ...filtros, finca: e.target.value || undefined })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        >
          <option value="">Todas las fincas</option>
          {FINCAS.map((finca) => (
            <option key={finca} value={finca}>
              {finca}
            </option>
          ))}
        </select>
      </label>

      {(filtros.semana || filtros.fecha || filtros.finca) && (
        <button
          onClick={() => onChange({})}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-banex-700 transition-colors hover:bg-banex-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

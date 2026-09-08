import { useEffect } from 'react'
import { useFincas } from '../lib/useFincas'
import { usePerfil } from '../lib/usePerfil'
import type { Filtros } from '../lib/useProducciones'

interface Props {
  filtros: Filtros
  onChange: (filtros: Filtros) => void
}

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function FiltersBar({ filtros, onChange }: Props) {
  const { fincas: todasLasFincas } = useFincas()
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const fincasDisponibles = esOperador
    ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre))
    : todasLasFincas
  // Con una sola finca asignada, el filtro queda fijo en ella (como antes);
  // con varias, el operador puede elegir entre las suyas o ver todas juntas.
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  useEffect(() => {
    if (fincaUnicaOperador && filtros.finca !== fincaUnicaOperador) {
      onChange({ ...filtros, finca: fincaUnicaOperador })
    }
  }, [fincaUnicaOperador, filtros, onChange])

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
          disabled={!!fincaUnicaOperador}
          onChange={(e) => onChange({ ...filtros, finca: e.target.value || undefined })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {fincaUnicaOperador ? (
            <option value={fincaUnicaOperador}>{fincaUnicaOperador}</option>
          ) : (
            <>
              <option value="">{esOperador ? 'Todas mis fincas' : 'Todas las fincas'}</option>
              {fincasDisponibles.map((f) => (
                <option key={f.nombre} value={f.nombre}>
                  {f.nombre}
                </option>
              ))}
            </>
          )}
        </select>
      </label>

      {(filtros.semana || filtros.fecha || (!fincaUnicaOperador && filtros.finca)) && (
        <button
          onClick={() => onChange(fincaUnicaOperador ? { finca: fincaUnicaOperador } : {})}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-banex-700 transition-colors hover:bg-banex-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

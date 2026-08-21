import { useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import ProductionList from '../components/ProductionList'
import { useProducciones, type Filtros } from '../lib/useProducciones'
import { useReferencias } from '../lib/useReferencias'
import { useFincas } from '../lib/useFincas'
import { flattenItems } from '../lib/aggregations'
import type { Produccion, Referencia } from '../types/produccion'
import type { Finca } from '../types/finca'

export default function RecordsPage() {
  const [filtros, setFiltros] = useState<Filtros>({})
  const { registros, loading, error, refetch } = useProducciones(filtros)
  const { referencias } = useReferencias()
  const { fincas } = useFincas()
  const filas = useMemo(() => flattenItems(registros), [registros])

  const gruposPorSemana = useMemo(() => {
    const map = new Map<number, Produccion[]>()
    for (const r of registros) {
      const grupo = map.get(r.semana)
      if (grupo) grupo.push(r)
      else map.set(r.semana, [r])
    }
    return Array.from(map.entries())
  }, [registros])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">Historial de registros</h1>
        <p className="text-sm text-gray-500">{registros.length} registro(s) · {filas.length} línea(s)</p>
      </div>

      <FiltersBar filtros={filtros} onChange={setFiltros} />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : gruposPorSemana.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay registros para los filtros seleccionados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {gruposPorSemana.map(([semana, regs], idx) => (
            <WeekGroup
              key={semana}
              semana={semana}
              registros={regs}
              referencias={referencias}
              fincas={fincas}
              onChanged={refetch}
              defaultExpanded={idx === 0}
            />
          ))}

          <datalist id="referencias-catalogo">
            {referencias.map((r) => (
              <option key={r.marca} value={r.marca} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  )
}

function WeekGroup({
  semana,
  registros,
  referencias,
  fincas,
  onChanged,
  defaultExpanded,
}: {
  semana: number
  registros: Produccion[]
  referencias: Referencia[]
  fincas: Finca[]
  onChanged: () => void
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const fincasSemana = Array.from(new Set(registros.map((r) => r.finca))).sort()
  const fechas = registros.map((r) => r.fecha).sort()
  const fechaMin = fechas[0]
  const fechaMax = fechas[fechas.length - 1]

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-banex-800">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-banana-500" />
            Semana {semana}
          </span>
          <span className="text-xs text-gray-500">
            {registros.length} registro(s) · {fincasSemana.length} finca(s)
            {fechaMin && ` · ${fechaMin === fechaMax ? fechaMin : `${fechaMin} a ${fechaMax}`}`}
          </span>
        </div>
        <span className="shrink-0 rounded-md border border-banex-200 px-2 py-1 text-xs font-medium text-banex-700">
          {expanded ? 'Colapsar ▲' : 'Ver registros ▼'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 pt-3">
          <ProductionList
            registros={registros}
            referencias={referencias}
            fincas={fincas}
            onChanged={onChanged}
            showDatalist={false}
          />
        </div>
      )}
    </div>
  )
}

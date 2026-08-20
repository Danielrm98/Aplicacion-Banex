import { useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import ProductionList from '../components/ProductionList'
import ExportButtons from '../components/ExportButtons'
import { useProducciones, type Filtros } from '../lib/useProducciones'
import { useReferencias } from '../lib/useReferencias'
import { flattenItems } from '../lib/aggregations'

export default function RecordsPage() {
  const [filtros, setFiltros] = useState<Filtros>({})
  const { registros, loading, error, refetch } = useProducciones(filtros)
  const { referencias } = useReferencias()
  const filas = useMemo(() => flattenItems(registros), [registros])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Historial de registros</h1>
          <p className="text-sm text-gray-500">{registros.length} registro(s) · {filas.length} línea(s)</p>
        </div>
        <ExportButtons filas={filas} />
      </div>

      <FiltersBar filtros={filtros} onChange={setFiltros} />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : (
        <ProductionList registros={registros} referencias={referencias} onChanged={refetch} />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import { useProducciones, type Filtros } from '../lib/useProducciones'
import { useReferencias } from '../lib/useReferencias'
import { flattenItems, cajasPorReferencia } from '../lib/aggregations'

export default function RankingMarcasPage() {
  const [filtros, setFiltros] = useState<Filtros>({})
  const { registros, loading, error } = useProducciones(filtros)
  const { referencias } = useReferencias()

  const filas = useMemo(() => flattenItems(registros), [registros])
  const ranking = useMemo(() => cajasPorReferencia(filas), [filas])
  const totalCajas = useMemo(() => ranking.reduce((sum, r) => sum + r.cajas, 0), [ranking])
  const maximo = ranking[0]?.cajas ?? 0

  function catalogoDe(marca: string) {
    return referencias.find((r) => r.marca === marca) ?? null
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">Ranking de marcas</h1>
        <p className="text-sm text-gray-500">
          Todas las referencias producidas, ordenadas de la que más cajas acumula a la que menos.
        </p>
      </div>

      <FiltersBar filtros={filtros} onChange={setFiltros} />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : ranking.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay producción para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-2 pr-3 pl-4 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Marca</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 text-right font-medium">Fincas</th>
                <th className="py-2 pr-3 text-right font-medium">Cajas</th>
                <th className="py-2 pr-3 text-right font-medium">Cajas 20kg</th>
                <th className="py-2 pr-3 text-right font-medium">% del total</th>
                <th className="py-2 pr-4 font-medium">Participación</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, idx) => {
                const catalogo = catalogoDe(r.referencia)
                const porcentaje = totalCajas > 0 ? (r.cajas / totalCajas) * 100 : 0
                const anchoBarra = maximo > 0 ? (r.cajas / maximo) * 100 : 0
                return (
                  <tr key={r.referencia} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 pl-4 text-gray-400">{idx + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-gray-900 whitespace-nowrap">{r.referencia}</td>
                    <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{catalogo?.tipo_caja ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">{r.fincas}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-banex-800">{r.cajas.toLocaleString('es')}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-700">
                      {r.cajas20kg.toLocaleString('es', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">{porcentaje.toFixed(1)}%</td>
                    <td className="py-1.5 pr-4">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-banex-500" style={{ width: `${anchoBarra}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

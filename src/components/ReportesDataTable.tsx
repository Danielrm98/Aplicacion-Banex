import type { FilaCompleta } from '../lib/aggregations'

export default function ReportesDataTable({ filas }: { filas: FilaCompleta[] }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-3 text-sm text-gray-500">{filas.length} fila(s)</p>

      {filas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay datos para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Fecha</th>
                <th className="py-1.5 pr-3 font-medium">Semana</th>
                <th className="py-1.5 pr-3 font-medium">Finca</th>
                <th className="py-1.5 pr-3 font-medium">Hora fin.</th>
                <th className="py-1.5 pr-3 font-medium">Referencia</th>
                <th className="py-1.5 pr-3 font-medium">Cajas</th>
                <th className="py-1.5 pr-3 font-medium">Peso (kg)</th>
                <th className="py-1.5 pr-3 font-medium">Cajas 20kg</th>
                <th className="py-1.5 pr-3 font-medium">Racimos cos.</th>
                <th className="py-1.5 pr-3 font-medium">Racimos rec.</th>
                <th className="py-1.5 pr-3 font-medium">Racimos proc.</th>
                <th className="py-1.5 pr-3 font-medium">Canastillas</th>
                <th className="py-1.5 pr-3 font-medium">Kilos canast.</th>
                <th className="py-1.5 pr-3 font-medium">Peso neto racimo</th>
                <th className="py-1.5 pr-3 font-medium">Ratio</th>
                <th className="py-1.5 pr-3 font-medium">Merma</th>
                <th className="py-1.5 pr-3 font-medium">Transporte</th>
                <th className="py-1.5 pr-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.fecha}</td>
                  <td className="py-1.5 pr-3">{f.semana}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.finca}</td>
                  <td className="py-1.5 pr-3">{f.horaFinalizacion || '—'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap font-medium text-gray-900">{f.referencia || '—'}</td>
                  <td className="py-1.5 pr-3">{f.cantidadCajas}</td>
                  <td className="py-1.5 pr-3">{f.pesoNetoKg || '—'}</td>
                  <td className="py-1.5 pr-3">{f.cajas20kg.toFixed(2)}</td>
                  <td className="py-1.5 pr-3">{f.racimosCosechados}</td>
                  <td className="py-1.5 pr-3">{f.racimosRecusados}</td>
                  <td className="py-1.5 pr-3">{f.racimosProcesados}</td>
                  <td className="py-1.5 pr-3">{f.canastillas}</td>
                  <td className="py-1.5 pr-3">{f.kilosCanastillas.toFixed(2)}</td>
                  <td className="py-1.5 pr-3">{f.pesoNetoRacimo !== null ? f.pesoNetoRacimo.toFixed(2) : '—'}</td>
                  <td className="py-1.5 pr-3">{f.ratio !== null ? f.ratio.toFixed(2) : '—'}</td>
                  <td className="py-1.5 pr-3">{f.merma !== null ? `${f.merma.toFixed(1)}%` : '—'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.transporte || '—'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

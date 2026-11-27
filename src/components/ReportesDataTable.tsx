import type { FilaCompleta, ResumenDiaFinca } from '../lib/aggregations'

/**
 * Dos tablas separadas, igual que en el Excel exportado ("Reportes" y
 * "Resumen por día y finca"): la de Cajas tiene una fila por referencia/marca
 * (se repite si la finca procesó varias marcas ese día), y la de Racimos
 * tiene una sola fila por día/finca — así el ratio, la merma, las
 * canastillas, etc. no aparecen repetidas una vez por cada marca. Cada una
 * vive en su propia pestaña (ver DashboardPage.tsx), no una debajo de la
 * otra.
 */
export function TablaCajas({ filas }: { filas: FilaCompleta[] }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-3 text-sm text-gray-500">{filas.length} fila(s)</p>
      {filas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay datos para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TablaRacimos({ filas }: { filas: ResumenDiaFinca[] }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-3 text-sm text-gray-500">{filas.length} fila(s)</p>
      {filas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay datos para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Fecha</th>
                <th className="py-1.5 pr-3 font-medium">Día</th>
                <th className="py-1.5 pr-3 font-medium">Semana</th>
                <th className="py-1.5 pr-3 font-medium">Finca</th>
                <th className="py-1.5 pr-3 font-medium">Hora fin.</th>
                <th className="py-1.5 pr-3 font-medium">Racimos cos.</th>
                <th className="py-1.5 pr-3 font-medium">Racimos rec.</th>
                <th className="py-1.5 pr-3 font-medium">Racimos proc.</th>
                <th className="py-1.5 pr-3 font-medium">Calibración prom.</th>
                <th className="py-1.5 pr-3 font-medium">Prom. manos</th>
                <th className="py-1.5 pr-3 font-medium">Canastillas</th>
                <th className="py-1.5 pr-3 font-medium">Kilos canast.</th>
                <th className="py-1.5 pr-3 font-medium">Fruta no vendida</th>
                <th className="py-1.5 pr-3 font-medium">Kilos fruta no vend.</th>
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
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.dia}</td>
                  <td className="py-1.5 pr-3">{f.semana}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{f.finca}</td>
                  <td className="py-1.5 pr-3">{f.horaFinalizacion || '—'}</td>
                  <td className="py-1.5 pr-3">{f.racimosCosechados}</td>
                  <td className="py-1.5 pr-3">{f.racimosRecusados}</td>
                  <td className="py-1.5 pr-3">{f.racimosProcesados}</td>
                  <td className="py-1.5 pr-3">{f.gradoPromedio !== null ? f.gradoPromedio.toFixed(1) : '—'}</td>
                  <td className="py-1.5 pr-3">{f.promedioManos !== null ? f.promedioManos.toFixed(1) : '—'}</td>
                  <td className="py-1.5 pr-3">{f.canastillas}</td>
                  <td className="py-1.5 pr-3">{f.kilosCanastillas.toFixed(2)}</td>
                  <td className="py-1.5 pr-3">{f.frutaNoVendida}</td>
                  <td className="py-1.5 pr-3">{f.kilosFrutaNoVendida.toFixed(2)}</td>
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

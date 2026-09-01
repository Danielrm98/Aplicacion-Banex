import { useMemo, useState, type ReactNode } from 'react'
import FiltersBar from '../components/FiltersBar'
import StatTile from '../components/StatTile'
import ProductionOverTimeChart from '../components/charts/ProductionOverTimeChart'
import PorFincaSemanaChart from '../components/charts/PorFincaSemanaChart'
import SingleLineChart from '../components/charts/SingleLineChart'
import { chartColors } from '../components/charts/chartTheme'
import ReportesDataTable from '../components/ReportesDataTable'
import TabButton from '../components/TabButton'
import { useProducciones, type Filtros } from '../lib/useProducciones'
import { usePerfil } from '../lib/usePerfil'
import {
  flattenItems,
  porFecha,
  cajasPorFincaYSemana,
  totales,
  resumenPorRegistro,
  racimosPorFincaYSemana,
  racimosPorSemana,
  totalRacimosCosechados,
  ratioMermaPorFinca,
  ratioMermaPorSemana,
  filaCompleta,
} from '../lib/aggregations'

export default function DashboardPage() {
  const { perfil } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const [vista, setVista] = useState<'resumen' | 'tabla'>('resumen')
  const [filtros, setFiltros] = useState<Filtros>({})
  const { registros, loading, error } = useProducciones(filtros)

  // Los gráficos de tendencia (por semana) ignoran a propósito los filtros de
  // Semana y Día de proceso: si el usuario los usa para otra cosa en esta
  // misma pantalla, la comparación entre semanas anteriores y la actual no
  // debe romperse. Solo respetan el filtro de Finca.
  const { registros: registrosTendencia } = useProducciones({ finca: filtros.finca })

  const filas = useMemo(() => flattenItems(registros), [registros])
  const serieFecha = useMemo(() => porFecha(filas), [filas])
  const resumen = useMemo(() => totales(filas), [filas])

  const resumenes = useMemo(() => resumenPorRegistro(registros), [registros])
  const totalRacimos = useMemo(() => totalRacimosCosechados(resumenes), [resumenes])
  const tablaRatioMerma = useMemo(() => ratioMermaPorFinca(resumenes), [resumenes])

  const resumenesTendencia = useMemo(() => resumenPorRegistro(registrosTendencia), [registrosTendencia])
  const serieRacimosSemana = useMemo(() => racimosPorSemana(resumenesTendencia), [resumenesTendencia])
  const serieRacimosFincaSemana = useMemo(() => racimosPorFincaYSemana(resumenesTendencia), [resumenesTendencia])
  const serieRatioMerma = useMemo(() => ratioMermaPorSemana(resumenesTendencia), [resumenesTendencia])

  const filasTendencia = useMemo(() => flattenItems(registrosTendencia), [registrosTendencia])
  const serieCajasFincaSemana = useMemo(() => cajasPorFincaYSemana(filasTendencia), [filasTendencia])

  const filasCompletas = useMemo(() => filaCompleta(registros), [registros])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">Reportes</h1>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabButton active={vista === 'resumen'} onClick={() => setVista('resumen')}>
          Resumen
        </TabButton>
        {esAdmin && (
          <TabButton active={vista === 'tabla'} onClick={() => setVista('tabla')}>
            Tabla de datos
          </TabButton>
        )}
      </div>

      <FiltersBar filtros={filtros} onChange={setFiltros} />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : vista === 'tabla' && esAdmin ? (
        <ReportesDataTable filas={filasCompletas} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Cajas producidas" value={resumen.cajas.toLocaleString('es')} />
            <StatTile label="Cajas 20kg" value={resumen.cajas20kg.toLocaleString('es', { maximumFractionDigits: 2 })} />
            <StatTile label="Racimos cosechados" value={totalRacimos.toLocaleString('es')} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <ChartCard title="Producción por día">
                <ProductionOverTimeChart data={serieFecha} />
              </ChartCard>
            </div>
            <div className="lg:col-span-2">
              <ChartCard
                title="Cajas producidas por finca — semana a semana"
                subtitle="Historial completo por finca — no cambia con el filtro de Semana/Día"
              >
                <PorFincaSemanaChart data={serieCajasFincaSemana} seriesName="cajas" />
              </ChartCard>
            </div>
            <div className="lg:col-span-2">
              <ChartCard
                title="Racimos cosechados por semana"
                subtitle="Historial completo por finca — no cambia con el filtro de Semana/Día"
              >
                <SingleLineChart
                  data={serieRacimosSemana}
                  xKey="semana"
                  yKey="racimos"
                  seriesName="racimos"
                  xLabelFormatter={(v) => `S${v}`}
                />
              </ChartCard>
            </div>
            <div className="lg:col-span-2">
              <ChartCard
                title="Racimos cosechados por finca — semana a semana"
                subtitle="Historial completo por finca — no cambia con el filtro de Semana/Día"
              >
                <PorFincaSemanaChart data={serieRacimosFincaSemana} seriesName="racimos" />
              </ChartCard>
            </div>

            <div className="lg:col-span-2">
              <ChartCard title="Ratio y merma promedio por finca">
                <RatioMermaTable filas={tablaRatioMerma} />
              </ChartCard>
            </div>

            <ChartCard title="Ratio por semana" subtitle="Historial completo por finca">
              <SingleLineChart
                data={serieRatioMerma}
                xKey="semana"
                yKey="ratio"
                seriesName="ratio"
                xLabelFormatter={(v) => `S${v}`}
                valueFormatter={(v) => v.toFixed(2)}
              />
            </ChartCard>
            <ChartCard title="Merma por semana" subtitle="Historial completo por finca">
              <SingleLineChart
                data={serieRatioMerma}
                xKey="semana"
                yKey="merma"
                seriesName="merma"
                color={chartColors.orange}
                xLabelFormatter={(v) => `S${v}`}
                valueFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

function RatioMermaTable({
  filas,
}: {
  filas: { finca: string; ratio: number | null; merma: number | null }[]
}) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Sin datos para mostrar.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-1.5 pr-3 font-medium">Finca</th>
            <th className="py-1.5 pr-3 font-medium">Ratio promedio</th>
            <th className="py-1.5 pr-3 font-medium">Merma promedio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.finca} className="border-b border-gray-100">
              <td className="py-1.5 pr-3 font-medium text-gray-900">{f.finca}</td>
              <td className="py-1.5 pr-3">{f.ratio !== null ? f.ratio.toFixed(2) : '—'}</td>
              <td className="py-1.5 pr-3">{f.merma !== null ? `${f.merma.toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
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

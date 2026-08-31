import { useState, type FormEvent } from 'react'
import { useClima } from '../lib/useClima'
import { descripcionClima } from '../lib/climaCodigos'
import { diaSemana } from '../lib/diaSemana'
import { fechaLocalAyer, fechaLocalHoy } from '../lib/fechaLocal'
import { useLluviaReportada, guardarLluviaReportada, eliminarLluviaReportada, combinarHistorialLluvia } from '../lib/useLluviaReportada'
import LluviaHistorialChart from './charts/LluviaHistorialChart'
import type { Finca } from '../types/finca'
import type { LluviaReportada } from '../types/lluvia'

export default function FincaClimaPanel({ finca }: { finca: Finca | null }) {
  const tieneCoordenadas = finca?.latitud != null && finca?.longitud != null
  const { clima, loading, error } = useClima(tieneCoordenadas ? finca!.latitud : null, tieneCoordenadas ? finca!.longitud : null)
  const { reportes, refetch: refetchReportes } = useLluviaReportada(finca?.nombre ?? null)
  const [verHistorial, setVerHistorial] = useState(false)

  if (!tieneCoordenadas) {
    return (
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <p className="text-sm text-gray-500">
          Esta finca todavía no tiene coordenadas registradas. Agrégalas en Catálogo → Fincas para ver el pronóstico
          del clima.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-banex-600 uppercase">Clima</p>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando clima...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : clima ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{descripcionClima(clima.actual.codigo).icono}</span>
            <div>
              <p className="text-lg font-semibold text-gray-900">{Math.round(clima.actual.temperatura)}°C</p>
              <p className="text-xs text-gray-500">{descripcionClima(clima.actual.codigo).texto}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <p>Humedad: {clima.actual.humedad}%</p>
            <p>Viento: {Math.round(clima.actual.vientoKmh)} km/h</p>
            <p>
              Lluvia en este momento:{' '}
              <span className={clima.actual.lluviaAhora > 0 ? 'font-medium text-blue-600' : ''}>
                {clima.actual.lluviaAhora > 0 ? `${clima.actual.lluviaAhora.toFixed(1)} mm/h` : 'sin lluvia'}
              </span>
            </p>
            <p>Acumulado hoy (con pronóstico): {clima.dias[0].precipitacionMm.toFixed(1)} mm</p>
            <p>Evapotranspiración: {clima.dias[0].evapotranspiracionMm.toFixed(1)} mm</p>
          </div>

          <div className="ml-auto flex gap-3">
            {clima.dias.map((d) => (
              <div key={d.fecha} className="text-center">
                <p className="text-[10px] font-medium text-gray-500 uppercase">{diaSemana(d.fecha).slice(0, 3)}</p>
                <p className="text-lg">{descripcionClima(d.codigo).icono}</p>
                <p className="text-xs text-gray-700">
                  {Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°
                </p>
                <p className="text-[10px] text-gray-400">💧{d.probabilidadLluvia}% · {d.precipitacionMm.toFixed(1)}mm</p>
                <p className="text-[10px] text-gray-400">ET {d.evapotranspiracionMm.toFixed(1)}mm</p>
              </div>
            ))}
          </div>

          <div className="w-full">
            <button
              onClick={() => setVerHistorial((v) => !v)}
              className="text-xs font-medium text-banex-700 hover:text-banex-800"
            >
              {verHistorial ? '▾ Ocultar historial de lluvia (14 días)' : '▸ Ver historial de lluvia (14 días)'}
            </button>
            {verHistorial && (
              <div className="mt-2">
                <LluviaHistorialChart data={combinarHistorialLluvia(clima.historialLluvia, reportes)} />
                <ReportarLluvia finca={finca!.nombre} reportes={reportes} onSaved={refetchReportes} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ReportarLluvia({
  finca,
  reportes,
  onSaved,
}: {
  finca: string
  reportes: LluviaReportada[]
  onSaved: () => void
}) {
  const [fecha, setFecha] = useState(fechaLocalAyer())
  const [milimetros, setMilimetros] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const valor = Number(milimetros)
    if (!fecha) {
      setError('Selecciona una fecha.')
      return
    }
    if (milimetros === '' || Number.isNaN(valor) || valor < 0) {
      setError('Escribe los milímetros de lluvia (0 o más).')
      return
    }

    setGuardando(true)
    try {
      await guardarLluviaReportada(finca, fecha, valor)
      setMilimetros('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el reporte.')
    } finally {
      setGuardando(false)
    }
  }

  function editar(r: LluviaReportada) {
    setFecha(r.fecha)
    setMilimetros(String(r.milimetros))
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este reporte de lluvia?')) return
    try {
      await eliminarLluviaReportada(id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el reporte.')
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-600">
        Reportar lluvia real observada en finca (puedes registrarla o corregirla el día que sea)
      </p>
      <form onSubmit={guardar} className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-gray-500">Fecha</span>
          <input
            type="date"
            value={fecha}
            max={fechaLocalHoy()}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:border-banex-500 focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-gray-500">Milímetros</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={milimetros}
            onChange={(e) => setMilimetros(e.target.value)}
            placeholder="Ej. 4"
            className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:border-banex-500 focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-banex-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {reportes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reportes.slice(0, 8).map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600"
            >
              {r.fecha.slice(5)}: {r.milimetros}mm
              <button type="button" onClick={() => editar(r)} className="text-banex-700 hover:underline">
                editar
              </button>
              <button type="button" onClick={() => eliminar(r.id)} className="text-red-600 hover:underline">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

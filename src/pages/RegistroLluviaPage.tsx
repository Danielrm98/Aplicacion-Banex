import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import {
  useLluviaReportada,
  guardarLluviaReportada,
  eliminarLluviaReportada,
  obtenerTodaLaLluviaReportada,
} from '../lib/useLluviaReportada'
import { fechaLocalAyer, fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { exportLluviaToExcel } from '../lib/exportUtils'
import LluviaRegistradaChart from '../components/charts/LluviaRegistradaChart'
import type { LluviaReportada } from '../types/lluvia'

const OPCION_TODAS = '__todas__'

export default function RegistroLluviaPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const esOperador = perfil?.rol === 'operador'
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles = esOperador
    ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre))
    : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [fincaSeleccionada, setFincaSeleccionada] = useState<string>('')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (fincaSeleccionada !== fincaUnicaOperador) setFincaSeleccionada(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (fincaSeleccionada && (fincaSeleccionada === OPCION_TODAS || fincasDisponibles.some((f) => f.nombre === fincaSeleccionada))) return
    const guardada = obtenerFincaActual()
    if (guardada && fincasDisponibles.some((f) => f.nombre === guardada)) setFincaSeleccionada(guardada)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada])

  const fincaParaDatos = fincaSeleccionada === OPCION_TODAS ? null : fincaSeleccionada || null
  const { reportes, loading, refetch } = useLluviaReportada(fincaParaDatos)

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    if (nombre !== OPCION_TODAS) guardarFincaActual(nombre)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Registro de lluvia</h1>
      <p className="mb-6 text-sm text-gray-500">
        Milímetros de lluvia observados en cada finca, día a día. Solo se muestra lo que cada finca reporta — sin
        barras de pronóstico.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={fincaSeleccionada}
            disabled={!!fincaUnicaOperador}
            onChange={(e) => elegirFinca(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {!fincaUnicaOperador && <option value="">Selecciona una finca</option>}
            {esAdmin && <option value={OPCION_TODAS}>Todas las fincas (exportar todo)</option>}
            {fincasOrdenadas.map((f) => (
              <option key={f.nombre} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fincaSeleccionada === OPCION_TODAS ? (
        <ExportarTodas />
      ) : !fincaSeleccionada ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : (
        <DetalleFinca key={fincaSeleccionada} finca={fincaSeleccionada} reportes={reportes} onCambio={refetch} />
      )}
    </div>
  )
}

function ExportarTodas() {
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportar() {
    setError(null)
    setExportando(true)
    try {
      const todos = await obtenerTodaLaLluviaReportada()
      await exportLluviaToExcel(todos, 'lluvia_todas_las_fincas.xlsx')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el Excel.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm">
      <p className="mb-4 text-sm text-gray-500">
        Descarga el historial completo de lluvia reportado por todas las fincas en un solo Excel.
      </p>
      <button
        onClick={exportar}
        disabled={exportando}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700 disabled:opacity-60"
      >
        {exportando ? 'Generando Excel...' : 'Exportar a Excel'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function DetalleFinca({
  finca,
  reportes,
  onCambio,
}: {
  finca: string
  reportes: LluviaReportada[]
  onCambio: () => void
}) {
  const [fecha, setFecha] = useState(fechaLocalAyer())
  const [milimetros, setMilimetros] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const datosGrafico = useMemo(
    () => [...reportes].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => ({ fecha: r.fecha, milimetros: r.milimetros })),
    [reportes],
  )

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
      onCambio()
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
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el reporte.')
    }
  }

  async function exportar() {
    setError(null)
    setExportando(true)
    try {
      const filas = reportes.map((r) => ({ finca: r.finca, fecha: r.fecha, milimetros: r.milimetros }))
      await exportLluviaToExcel(filas, `lluvia_${finca}.xlsx`.replace(/\s+/g, '_'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el Excel.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-banex-800">{finca}</h2>
        <button
          onClick={exportar}
          disabled={exportando || reportes.length === 0}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700 disabled:opacity-50"
        >
          {exportando ? 'Generando Excel...' : 'Exportar a Excel'}
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <LluviaRegistradaChart data={datosGrafico} />
      </div>

      <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <p className="mb-2 text-xs font-semibold text-gray-600">
          Reportar lluvia real observada en finca (puedes registrarla o corregirla el día que sea)
        </p>
        <form onSubmit={guardar} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-500">Fecha</span>
            <input
              type="date"
              value={fecha}
              max={fechaLocalHoy()}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-banex-500 focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-500">Milímetros</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={milimetros}
              onChange={(e) => setMilimetros(e.target.value)}
              placeholder="Ej. 4"
              className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-banex-500 focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            />
          </label>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-banex-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {reportes.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Esta finca todavía no tiene lluvia reportada.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-2 pr-3 pl-4 font-medium">Fecha</th>
                <th className="px-2 py-2 text-center font-medium">Milímetros</th>
                <th className="px-2 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 pl-4 text-gray-900">{r.fecha}</td>
                  <td className="px-2 py-1.5 text-center text-gray-900">{r.milimetros}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => editar(r)} className="text-xs font-medium text-banex-700 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => eliminar(r.id)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

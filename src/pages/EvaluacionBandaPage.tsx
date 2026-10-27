import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { DEFECTOS_POR_GRUPO, GRUPOS_EVALUACION_BANDA, type GrupoEvaluacionBanda } from '../lib/catalogoEvaluacionBanda'
import { eliminarEvaluacionBanda, guardarEvaluacionBanda, useEvaluacionesBanda } from '../lib/useEvaluacionesBanda'
import SectionHeading from '../components/SectionHeading'
import MermaGrupoChart from '../components/charts/MermaGrupoChart'
import type { EvaluacionBanda } from '../types/evaluacionBanda'

export default function EvaluacionBandaPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
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

  const [fincaSeleccionada, setFincaSeleccionada] = useState('')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (fincaSeleccionada !== fincaUnicaOperador) setFincaSeleccionada(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (fincaSeleccionada && fincasDisponibles.some((f) => f.nombre === fincaSeleccionada)) return
    const guardada = obtenerFincaActual()
    if (guardada && fincasDisponibles.some((f) => f.nombre === guardada)) setFincaSeleccionada(guardada)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Evaluación de banda</h1>
      <p className="mb-6 text-sm text-gray-500">
        Seguimiento de los defectos de empacadora detectados en el corte: cuántos dedos presentan cada defecto, qué
        tanto pesa cada grupo dentro de lo evaluado, y qué tanto representa dentro de la merma real de la finca.
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
            {fincasOrdenadas.map((f) => (
              <option key={f.nombre} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!fincaSeleccionada ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : (
        <FormularioEvaluacionBanda key={fincaSeleccionada} finca={fincaSeleccionada} />
      )}
    </div>
  )
}

function claveDefecto(grupo: string, defecto: string): string {
  return `${grupo}::${defecto}`
}

function horaCorta(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

function FormularioEvaluacionBanda({ finca }: { finca: string }) {
  const { evaluaciones, refetch } = useEvaluacionesBanda(finca)

  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [mermaFincaTexto, setMermaFincaTexto] = useState('')
  const [evaluacionIdActual, setEvaluacionIdActual] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const semana = getIsoWeek(fecha)
  const evaluacionesHoy = evaluaciones.filter((e) => e.fecha === fechaLocalHoy()).length

  // Una finca puede guardar varias evaluaciones el mismo día (al menos 3
  // durante el proceso), así que la fecha ya no identifica una sola — para
  // corregir una en particular hay que abrirla desde la lista de abajo.
  function nuevaEvaluacion(fechaStr: string = fecha) {
    setFecha(fechaStr)
    setEvaluacionIdActual(null)
    setCantidades({})
    setMermaFincaTexto('')
    setError(null)
    setMensajeExito(null)
  }

  function abrirEvaluacion(ev: EvaluacionBanda) {
    setFecha(ev.fecha)
    setEvaluacionIdActual(ev.id)
    setMermaFincaTexto(ev.merma_finca !== null ? String(ev.merma_finca) : '')
    const nuevasCantidades: Record<string, number> = {}
    for (const it of ev.items) {
      nuevasCantidades[claveDefecto(it.grupo, it.defecto)] = it.cantidad
    }
    setCantidades(nuevasCantidades)
    setError(null)
    setMensajeExito(null)
  }

  function cantidadDe(grupo: string, defecto: string) {
    return cantidades[claveDefecto(grupo, defecto)] ?? 0
  }

  function setCantidad(grupo: string, defecto: string, valor: number) {
    setCantidades((prev) => ({ ...prev, [claveDefecto(grupo, defecto)]: valor }))
    setMensajeExito(null)
  }

  const grupoDedos = useMemo(() => {
    const map = {} as Record<GrupoEvaluacionBanda, number>
    for (const grupo of GRUPOS_EVALUACION_BANDA) {
      map[grupo] = DEFECTOS_POR_GRUPO[grupo].reduce((sum, defecto) => sum + cantidadDe(grupo, defecto), 0)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidades])

  const totalDedos = useMemo(() => Object.values(grupoDedos).reduce((a, b) => a + b, 0), [grupoDedos])

  const porcentajeMerma = useMemo(() => {
    const map = {} as Record<GrupoEvaluacionBanda, number | null>
    for (const grupo of GRUPOS_EVALUACION_BANDA) {
      map[grupo] = totalDedos > 0 ? (grupoDedos[grupo] / totalDedos) * 100 : null
    }
    return map
  }, [grupoDedos, totalDedos])

  const mermaFincaNumero = mermaFincaTexto === '' ? null : Number(mermaFincaTexto)
  const mermaFincaValida = mermaFincaNumero !== null && !Number.isNaN(mermaFincaNumero)

  const mermaDeFincaPorGrupo = useMemo(() => {
    const map = {} as Record<GrupoEvaluacionBanda, number | null>
    for (const grupo of GRUPOS_EVALUACION_BANDA) {
      const pct = porcentajeMerma[grupo]
      map[grupo] = pct !== null && mermaFincaValida ? (pct * (mermaFincaNumero as number)) / 100 : null
    }
    return map
  }, [porcentajeMerma, mermaFincaValida, mermaFincaNumero])

  const sumaMermaDeFincaPorGrupo = useMemo(
    () => Object.values(mermaDeFincaPorGrupo).reduce<number>((sum, v) => sum + (v ?? 0), 0),
    [mermaDeFincaPorGrupo],
  )

  const datosChart = useMemo(
    () =>
      totalDedos > 0
        ? GRUPOS_EVALUACION_BANDA.map((grupo) => ({
            grupo,
            porcentajeMerma: porcentajeMerma[grupo] ?? 0,
            mermaDeFinca: mermaDeFincaPorGrupo[grupo] ?? 0,
          }))
        : [],
    [totalDedos, porcentajeMerma, mermaDeFincaPorGrupo],
  )

  async function guardar() {
    setError(null)
    if (mermaFincaTexto !== '' && !mermaFincaValida) {
      setError('La merma de finca debe ser un número.')
      return
    }
    if (mermaFincaValida && (mermaFincaNumero! < 0 || mermaFincaNumero! > 100)) {
      setError('La merma de finca debe estar entre 0 y 100.')
      return
    }

    setGuardando(true)
    try {
      const items = GRUPOS_EVALUACION_BANDA.flatMap((grupo) =>
        DEFECTOS_POR_GRUPO[grupo].map((defecto) => ({ grupo, defecto, cantidad: cantidadDe(grupo, defecto) })),
      )
      const id = await guardarEvaluacionBanda({
        idExistente: evaluacionIdActual,
        finca,
        fecha,
        semana,
        mermaFinca: mermaFincaValida ? mermaFincaNumero : null,
        items,
      })
      setEvaluacionIdActual(id)
      setMensajeExito('Evaluación guardada.')
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la evaluación.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta evaluación? No se puede deshacer.')) return
    try {
      await eliminarEvaluacionBanda(id)
      if (id === evaluacionIdActual) nuevaEvaluacion()
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              max={fechaLocalHoy()}
              onChange={(e) => nuevaEvaluacion(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Semana">
            <input type="text" disabled value={semana} className={`${inputClass} bg-gray-50`} />
          </Field>
          <Field label="Suma de dedos">
            <input type="text" disabled value={totalDedos} className={`${inputClass} bg-gray-50 font-semibold`} />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Llevas {evaluacionesHoy} evaluación{evaluacionesHoy === 1 ? '' : 'es'} guardada{evaluacionesHoy === 1 ? '' : 's'} hoy — se
            puede guardar más de una en el mismo día.
          </p>
          {(evaluacionIdActual || totalDedos > 0 || mermaFincaTexto !== '') && (
            <button
              type="button"
              onClick={() => nuevaEvaluacion()}
              className="text-xs font-medium text-banex-700 hover:underline"
            >
              + Nueva evaluación
            </button>
          )}
        </div>
        {evaluacionIdActual && (
          <p className="mt-1 text-xs text-banex-700">Editando una evaluación ya guardada de esta finca y fecha.</p>
        )}
      </div>

      <div>
        <SectionHeading>Grupos y defectos</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GRUPOS_EVALUACION_BANDA.map((grupo) => (
            <div key={grupo} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-banex-800">{grupo}</h3>
                <span className="rounded-full bg-banex-50 px-2.5 py-0.5 text-xs font-semibold text-banex-700">
                  {grupoDedos[grupo]} dedos
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {DEFECTOS_POR_GRUPO[grupo].map((defecto) => (
                  <label key={defecto} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600">{defecto}</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={cantidadDe(grupo, defecto) || ''}
                      onChange={(e) => setCantidad(grupo, defecto, Math.max(0, Number(e.target.value)))}
                      className="w-20 shrink-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-right text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-banex-500/20"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <SectionHeading>Mermas por grupo</SectionHeading>
          <p className="mb-2 text-xs text-gray-500">Qué tanto pesa cada grupo dentro del total de dedos evaluados.</p>
          <table className="w-full text-sm">
            <tbody>
              {GRUPOS_EVALUACION_BANDA.map((grupo) => {
                const pct = porcentajeMerma[grupo]
                return (
                  <tr key={grupo} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-gray-600">{grupo}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{pct !== null ? `${pct.toFixed(2)}%` : '—'}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-banex-100 font-semibold text-banex-800">
                <td className="py-1.5">Total</td>
                <td className="py-1.5 text-right">{totalDedos > 0 ? '100,00%' : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-banex-100 bg-banex-50/40 shadow-sm p-4">
          <SectionHeading>Merma de finca</SectionHeading>
          <Field label="Merma real de finca (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={mermaFincaTexto}
              onChange={(e) => {
                setMermaFincaTexto(e.target.value)
                setMensajeExito(null)
              }}
              placeholder="Ej. 13.6"
              className={inputClass}
            />
          </Field>
          <p className="mt-2 mb-1 text-xs text-gray-500">Qué tanto representa cada grupo dentro de esa merma real.</p>
          <table className="w-full text-sm">
            <tbody>
              {GRUPOS_EVALUACION_BANDA.map((grupo) => {
                const valor = mermaDeFincaPorGrupo[grupo]
                return (
                  <tr key={grupo} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-gray-600">{grupo}</td>
                    <td className="py-1.5 text-right font-medium text-gray-900">{valor !== null ? `${valor.toFixed(2)}%` : '—'}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-banex-200 font-semibold text-banex-800">
                <td className="py-1.5">Total</td>
                <td className="py-1.5 text-right">{mermaFincaValida ? `${sumaMermaDeFincaPorGrupo.toFixed(2)}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <SectionHeading>Merma por grupo: % del total vs % merma de finca</SectionHeading>
        <MermaGrupoChart data={datosChart} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : evaluacionIdActual ? 'Actualizar evaluación' : 'Guardar evaluación'}
        </button>
        {mensajeExito && <span className="text-sm text-green-700">{mensajeExito}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {evaluaciones.length > 0 && (
        <div>
          <SectionHeading>Evaluaciones guardadas</SectionHeading>
          <p className="mb-2 text-xs text-gray-500">
            Es solo información del día en curso, no queda como historial: al guardar una evaluación nueva se borra lo
            de días anteriores de esta finca.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="py-2 px-3 font-medium">Fecha</th>
                  <th className="py-2 px-3 font-medium">Hora</th>
                  <th className="py-2 px-3 font-medium">Semana</th>
                  <th className="py-2 px-3 font-medium">Suma de dedos</th>
                  <th className="py-2 px-3 font-medium">Merma de finca</th>
                  <th className="py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((ev) => (
                  <tr key={ev.id} className={`border-b border-gray-100 ${ev.id === evaluacionIdActual ? 'bg-banex-50/60' : ''}`}>
                    <td className="py-1.5 px-3">{ev.fecha}</td>
                    <td className="py-1.5 px-3">{horaCorta(ev.created_at)}</td>
                    <td className="py-1.5 px-3">{ev.semana}</td>
                    <td className="py-1.5 px-3">{ev.items.reduce((s, it) => s + it.cantidad, 0)}</td>
                    <td className="py-1.5 px-3">{ev.merma_finca !== null ? `${ev.merma_finca}%` : '—'}</td>
                    <td className="py-1.5 px-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirEvaluacion(ev)} className="text-xs font-medium text-banex-700 hover:underline">
                        Abrir
                      </button>
                      <button onClick={() => eliminar(ev.id)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:text-gray-500'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

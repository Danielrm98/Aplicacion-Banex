import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { esErrorDeRed } from '../lib/colaRegistros'
import { agregarEvaluacionBandaACola } from '../lib/colaEvaluacionBanda'
import { DEFECTOS_POR_GRUPO, GRUPOS_EVALUACION_BANDA, type GrupoEvaluacionBanda } from '../lib/catalogoEvaluacionBanda'
import {
  eliminarEvaluacionBanda,
  guardarEvaluacionBanda,
  useEvaluacionesBanda,
  type EvaluacionBandaPayload,
} from '../lib/useEvaluacionesBanda'
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

function defectosExtraVacio(): Record<GrupoEvaluacionBanda, string[]> {
  const vacio = {} as Record<GrupoEvaluacionBanda, string[]>
  for (const grupo of GRUPOS_EVALUACION_BANDA) vacio[grupo] = []
  return vacio
}

function esGrupoValido(grupo: string): grupo is GrupoEvaluacionBanda {
  return (GRUPOS_EVALUACION_BANDA as readonly string[]).includes(grupo)
}

function FormularioEvaluacionBanda({ finca }: { finca: string }) {
  const { session } = useAuth()
  const { evaluaciones, refetch } = useEvaluacionesBanda(finca)

  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [mermaFincaTexto, setMermaFincaTexto] = useState('')
  const [evaluacionIdActual, setEvaluacionIdActual] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  // Defectos que el operario agrega a mano porque no están en la lista fija
  // del formato en papel — se guardan igual que cualquier otro defecto.
  const [defectosExtra, setDefectosExtra] = useState<Record<GrupoEvaluacionBanda, string[]>>(defectosExtraVacio)
  const [nuevoDefectoTexto, setNuevoDefectoTexto] = useState('')
  const [agregandoDefectoEn, setAgregandoDefectoEn] = useState<GrupoEvaluacionBanda | null>(null)

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
    setDefectosExtra(defectosExtraVacio())
    setAgregandoDefectoEn(null)
    setNuevoDefectoTexto('')
    setError(null)
    setMensajeExito(null)
  }

  function abrirEvaluacion(ev: EvaluacionBanda) {
    setFecha(ev.fecha)
    setEvaluacionIdActual(ev.id)
    setMermaFincaTexto(ev.merma_finca !== null ? String(ev.merma_finca) : '')
    const nuevasCantidades: Record<string, number> = {}
    const nuevosExtra = defectosExtraVacio()
    for (const it of ev.items) {
      nuevasCantidades[claveDefecto(it.grupo, it.defecto)] = it.cantidad
      if (esGrupoValido(it.grupo) && !DEFECTOS_POR_GRUPO[it.grupo].includes(it.defecto)) {
        if (!nuevosExtra[it.grupo].includes(it.defecto)) nuevosExtra[it.grupo].push(it.defecto)
      }
    }
    setCantidades(nuevasCantidades)
    setDefectosExtra(nuevosExtra)
    setAgregandoDefectoEn(null)
    setNuevoDefectoTexto('')
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

  function agregarDefectoExtra(grupo: GrupoEvaluacionBanda) {
    const nombre = nuevoDefectoTexto.trim().toUpperCase()
    if (!nombre) return
    const yaExiste = DEFECTOS_POR_GRUPO[grupo].includes(nombre) || defectosExtra[grupo].includes(nombre)
    if (!yaExiste) {
      setDefectosExtra((prev) => ({ ...prev, [grupo]: [...prev[grupo], nombre] }))
    }
    setNuevoDefectoTexto('')
    setAgregandoDefectoEn(null)
  }

  function quitarDefectoExtra(grupo: GrupoEvaluacionBanda, defecto: string) {
    setDefectosExtra((prev) => ({ ...prev, [grupo]: prev[grupo].filter((d) => d !== defecto) }))
    setCantidades((prev) => {
      const copia = { ...prev }
      delete copia[claveDefecto(grupo, defecto)]
      return copia
    })
  }

  const grupoDedos = useMemo(() => {
    const map = {} as Record<GrupoEvaluacionBanda, number>
    for (const grupo of GRUPOS_EVALUACION_BANDA) {
      const defectos = [...DEFECTOS_POR_GRUPO[grupo], ...defectosExtra[grupo]]
      map[grupo] = defectos.reduce((sum, defecto) => sum + cantidadDe(grupo, defecto), 0)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidades, defectosExtra])

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

  // Mismo desglose que "Merma de finca", pero por defecto individual en vez
  // de por grupo — para ver cuáles defectos puntuales son los que más están
  // pesando dentro de la merma real, no solo a qué grupo pertenecen.
  const defectosRegistrados = useMemo(() => {
    const filas: {
      grupo: GrupoEvaluacionBanda
      defecto: string
      cantidad: number
      porcentajeTotal: number | null
      porcentajeMermaFinca: number | null
    }[] = []
    for (const grupo of GRUPOS_EVALUACION_BANDA) {
      for (const defecto of [...DEFECTOS_POR_GRUPO[grupo], ...defectosExtra[grupo]]) {
        const cantidad = cantidadDe(grupo, defecto)
        if (cantidad <= 0) continue
        const porcentajeTotal = totalDedos > 0 ? (cantidad / totalDedos) * 100 : null
        const porcentajeMermaFinca =
          porcentajeTotal !== null && mermaFincaValida ? (porcentajeTotal * (mermaFincaNumero as number)) / 100 : null
        filas.push({ grupo, defecto, cantidad, porcentajeTotal, porcentajeMermaFinca })
      }
    }
    return filas.sort((a, b) => (b.porcentajeTotal ?? 0) - (a.porcentajeTotal ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidades, defectosExtra, totalDedos, mermaFincaValida, mermaFincaNumero])

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

    // Se toma de la sesión ya cargada en la app (con respaldo local si no
    // hay señal), no de una consulta nueva a Supabase: esa sí necesita
    // conexión y es lo que hacía fallar el guardado sin internet.
    const user = session?.user
    if (!user) {
      setError('No hay sesión activa.')
      return
    }

    const items = GRUPOS_EVALUACION_BANDA.flatMap((grupo) =>
      [...DEFECTOS_POR_GRUPO[grupo], ...defectosExtra[grupo]].map((defecto) => ({
        grupo,
        defecto,
        cantidad: cantidadDe(grupo, defecto),
      })),
    )
    // El id siempre se genera en el celular (no se espera a que la base de
    // datos lo asigne), así el mismo guardado sirve tanto si hay señal
    // ahora mismo como si queda pendiente para sincronizarse después.
    const payload: EvaluacionBandaPayload = {
      id: evaluacionIdActual ?? crypto.randomUUID(),
      userId: user.id,
      finca,
      fecha,
      semana,
      mermaFinca: mermaFincaValida ? mermaFincaNumero : null,
      items,
    }

    setGuardando(true)

    if (!navigator.onLine) {
      await agregarEvaluacionBandaACola(payload)
      setGuardando(false)
      nuevaEvaluacion(fecha)
      setMensajeExito('Guardada sin conexión — se enviará sola cuando vuelva la señal.')
      return
    }

    try {
      await guardarEvaluacionBanda(payload)
      // Queda lista para la siguiente evaluación del día, en vez de dejar
      // la información anterior para borrarla a mano.
      nuevaEvaluacion(fecha)
      setMensajeExito('Evaluación guardada. El formulario quedó listo para una nueva.')
      refetch()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarEvaluacionBandaACola(payload)
        nuevaEvaluacion(fecha)
        setMensajeExito('Guardada sin conexión — se enviará sola cuando vuelva la señal.')
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la evaluación.')
      }
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
                {defectosExtra[grupo].map((defecto) => (
                  <label key={defecto} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1 text-gray-600">
                      <span className="truncate">{defecto}</span>
                      <button
                        type="button"
                        onClick={() => quitarDefectoExtra(grupo, defecto)}
                        title="Quitar este defecto"
                        className="shrink-0 text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
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

                {agregandoDefectoEn === grupo ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={nuevoDefectoTexto}
                      onChange={(e) => setNuevoDefectoTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          agregarDefectoExtra(grupo)
                        }
                      }}
                      placeholder="Nombre del defecto"
                      className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-banex-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => agregarDefectoExtra(grupo)}
                      className="shrink-0 rounded-md bg-banex-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAgregandoDefectoEn(null)
                        setNuevoDefectoTexto('')
                      }}
                      className="shrink-0 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAgregandoDefectoEn(grupo)
                      setNuevoDefectoTexto('')
                    }}
                    className="mt-1 text-left text-xs font-medium text-banex-700 hover:underline"
                  >
                    + Agregar otro defecto
                  </button>
                )}
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

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <SectionHeading>Defectos registrados sobre la merma de finca</SectionHeading>
        <p className="mb-2 text-xs text-gray-500">
          Cada defecto con cantidad registrada, qué tanto pesa dentro de lo evaluado y qué tanto representa dentro de
          la merma real de la finca.
        </p>
        {defectosRegistrados.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Registra cantidades para ver el detalle por defecto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1.5 pr-3 font-medium">Defecto</th>
                  <th className="py-1.5 pr-3 font-medium">Grupo</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Dedos</th>
                  <th className="py-1.5 pr-3 text-right font-medium">% del total</th>
                  <th className="py-1.5 pr-3 text-right font-medium">% merma de finca</th>
                </tr>
              </thead>
              <tbody>
                {defectosRegistrados.map((f) => (
                  <tr key={claveDefecto(f.grupo, f.defecto)} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-900">{f.defecto}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{f.grupo}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-900">{f.cantidad}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-900">
                      {f.porcentajeTotal !== null ? `${f.porcentajeTotal.toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-medium text-banex-800">
                      {f.porcentajeMermaFinca !== null ? `${f.porcentajeMermaFinca.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

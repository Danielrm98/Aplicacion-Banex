import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { puedeEscribir, usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { getIsoWeek, getIsoYear } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { esErrorDeRed, LIMITE_ENVIO_MS } from '../lib/colaRegistros'
import { conLimite } from '../lib/promesaConLimite'
import { agregarCosechaPorEdadACola } from '../lib/colaCosechaPorEdad'
import { useCosechaPorEdad } from '../lib/useCosechaPorEdad'
import { useEscaleraProduccion } from '../lib/useEscaleraProduccion'
import { EDADES_COSECHA, type EdadCosecha } from '../types/escaleraProduccion'
import SectionHeading from '../components/SectionHeading'
import TabButton from '../components/TabButton'
import type { Finca } from '../types/finca'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function EscaleraProduccionPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const esAdminLectura = perfil?.rol === 'admin_lectura'
  const escritura = puedeEscribir(perfil)
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles =
    esOperador || esAdminLectura ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre)) : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [fincaSeleccionada, setFincaSeleccionada] = useState('')
  const [vista, setVista] = useState<'escalera' | 'registro'>('escalera')

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

  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Escalera de producción</h1>
      <p className="mb-6 text-sm text-gray-500">
        Proyecta, a partir del embolse semanal, en qué semana se va a cosechar cada cohorte y cuántos racimos va a
        rendir. Lo ya pasado se muestra en verde (real); lo que falta, en celeste (estimado).
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

      {!finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-gray-200">
            <TabButton active={vista === 'escalera'} onClick={() => setVista('escalera')}>
              Escalera
            </TabButton>
            <TabButton active={vista === 'registro'} onClick={() => setVista('registro')}>
              Registro semanal
            </TabButton>
          </div>
          {vista === 'escalera' ? (
            <EscaleraTabla key={finca.nombre} finca={finca} />
          ) : (
            <RegistroCosechaPorEdad key={finca.nombre} finca={finca} escritura={escritura} />
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// Pestaña "Escalera": tabla de solo lectura, semana de embolse → semana de
// cosecha, con lo real ya cargado y lo futuro proyectado.
// ============================================================
function EscaleraTabla({ finca }: { finca: Finca }) {
  const { filas, loading, anioActual, semanaActual } = useEscaleraProduccion(finca)

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>

  return (
    <div>
      <p className="mb-3 text-xs text-gray-400">
        Semana actual: {semanaActual}/{anioActual}. La proyección de embolse usa el promedio de semanas recientes y de
        esta misma época en años anteriores; la distribución por edad usa lo cargado en "Registro semanal".
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-[900px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="w-[110px] px-3 py-2 font-medium">Sem. Embolse</th>
              <th className="w-[100px] px-2 py-2 text-center font-medium">Hectáreas</th>
              <th className="w-[100px] px-2 py-2 text-center font-medium">Bell/Ha</th>
              <th className="w-[120px] px-2 py-2 text-center font-medium">Embolse</th>
              <th className="w-[110px] px-2 py-2 text-center font-medium">Sem. Cosecha</th>
              <th className="w-[90px] px-2 py-2 text-center font-medium">Recobro</th>
              <th className="w-[140px] px-2 py-2 text-center font-medium">Racimos cosechados</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const esFutura = !f.esCosechaReal
              return (
                <tr
                  key={`${f.anioEmbolse}_${f.semanaEmbolse}`}
                  className={`border-b border-gray-100 ${esFutura ? 'bg-cyan-50/60' : 'bg-green-50/40'}`}
                >
                  <td className="px-3 py-1.5 font-medium text-gray-900">
                    {f.semanaEmbolse}/{f.anioEmbolse}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-500">
                    {f.hectareas != null ? f.hectareas.toLocaleString('es') : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-700">{f.bellPorHa.toFixed(1)}</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${esFutura ? 'text-cyan-700' : 'text-green-700'}`}>
                    {Math.round(f.embolseReal).toLocaleString('es')}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-700">
                    {f.semanaCosecha}/{f.anioCosecha}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{(f.recobro * 100).toFixed(0)}%</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${esFutura ? 'text-cyan-700' : 'text-green-700'}`}>
                    {Math.round(f.racimosCosechados).toLocaleString('es')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-green-100" /> Real (ya pasó)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-cyan-100" /> Estimado (proyección)
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Pestaña "Registro semanal": captura de cuántos racimos cosechados traían
// cinta de cada edad (8 a 13 semanas) — lo que alimenta la distribución de
// la escalera. Una fila por finca/semana (no por lote).
// ============================================================
function RegistroCosechaPorEdad({ finca, escritura }: { finca: Finca; escritura: boolean }) {
  const { session } = useAuth()
  const { filas, loading, refetch } = useCosechaPorEdad(finca.nombre)

  const [anio, setAnio] = useState(() => getIsoYear(fechaLocalHoy()))
  const [semana, setSemana] = useState(() => getIsoWeek(fechaLocalHoy()))
  const [valores, setValores] = useState<Record<EdadCosecha, string>>({ 8: '', 9: '', 10: '', 11: '', 12: '', 13: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadoSinConexion, setGuardadoSinConexion] = useState(false)

  useEffect(() => {
    const siguiente: Record<EdadCosecha, string> = { 8: '', 9: '', 10: '', 11: '', 12: '', 13: '' }
    for (const f of filas) {
      if (f.anio === anio && f.semana === semana) siguiente[f.edad_semanas] = String(f.racimos)
    }
    setValores(siguiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, semana, filas])

  const semanasConDatos = useMemo(() => {
    const porSemana = new Map<string, { anio: number; semana: number; total: number }>()
    for (const f of filas) {
      const clave = `${f.anio}_${f.semana}`
      const actual = porSemana.get(clave) ?? { anio: f.anio, semana: f.semana, total: 0 }
      actual.total += f.racimos
      porSemana.set(clave, actual)
    }
    return [...porSemana.values()].sort((a, b) => b.anio - a.anio || b.semana - a.semana)
  }, [filas])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardadoSinConexion(false)
    const user = session?.user
    if (!user) return

    const aGuardar = EDADES_COSECHA.filter((edad) => valores[edad].trim() !== '').map((edad) => ({
      finca: finca.nombre,
      anio,
      semana,
      edad_semanas: edad,
      racimos: Number(valores[edad]) || 0,
      user_id: user.id,
    }))
    if (aGuardar.length === 0) {
      setError('Ingresa al menos una cantidad.')
      return
    }
    if (aGuardar.some((f) => f.racimos < 0 || Number.isNaN(f.racimos))) {
      setError('Las cantidades deben ser números válidos.')
      return
    }

    setGuardando(true)
    try {
      if (!navigator.onLine) {
        for (const payload of aGuardar) await agregarCosechaPorEdadACola(payload)
        setGuardadoSinConexion(true)
      } else {
        await conLimite(
          (async () => {
            const { error: upsertError } = await supabase
              .from('cosecha_por_edad')
              .upsert(aGuardar, { onConflict: 'finca,anio,semana,edad_semanas' })
            if (upsertError) throw upsertError
          })(),
          LIMITE_ENVIO_MS,
        )
      }
      refetch()
    } catch (err) {
      if (esErrorDeRed(err)) {
        for (const payload of aGuardar) await agregarCosechaPorEdadACola(payload)
        setGuardadoSinConexion(true)
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      }
    } finally {
      setGuardando(false)
    }
  }

  const campoClase =
    'w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-center text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20'

  return (
    <div>
      {escritura && (
        <form onSubmit={guardar} className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <SectionHeading>Racimos cosechados por edad</SectionHeading>
          <p className="mb-3 text-xs text-gray-500">
            De los racimos cosechados esta semana, cuántos traían cinta de cada edad (semanas desde el embolse).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Semana</span>
              <select
                value={semana}
                onChange={(e) => setSemana(Number(e.target.value))}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
              >
                {SEMANAS.map((s) => (
                  <option key={s} value={s}>
                    Semana {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Año</span>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
              />
            </label>
            {EDADES_COSECHA.map((edad) => (
              <label key={edad} className="text-sm">
                <span className="mb-1 block text-gray-600">{edad} sem.</span>
                <input
                  type="number"
                  min={0}
                  value={valores[edad]}
                  onChange={(e) => setValores((prev) => ({ ...prev, [edad]: e.target.value }))}
                  className={campoClase}
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {guardadoSinConexion && (
            <p className="mt-2 text-sm text-amber-700">
              📶 Sin conexión: quedó guardado en el dispositivo y se enviará solo en cuanto vuelva la señal.
            </p>
          )}
        </form>
      )}

      <SectionHeading>Semanas registradas</SectionHeading>
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : semanasConDatos.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Todavía no hay semanas registradas para esta finca.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Semana</th>
                <th className="px-2 py-2 text-right font-medium">Total racimos</th>
              </tr>
            </thead>
            <tbody>
              {semanasConDatos.map((s) => (
                <tr
                  key={`${s.anio}_${s.semana}`}
                  className="cursor-pointer border-b border-gray-100 hover:bg-banex-50"
                  onClick={() => {
                    setAnio(s.anio)
                    setSemana(s.semana)
                  }}
                >
                  <td className="px-4 py-2 font-medium text-gray-900">
                    Semana {s.semana}/{s.anio}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">{s.total.toLocaleString('es')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { anioEmbolsesDe, sumarSemanas } from '../lib/anioEmbolses'
import { colorCintaDe, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { supabase } from '../lib/supabaseClient'
import { conLimite } from '../lib/promesaConLimite'
import { LIMITE_ENVIO_MS } from '../lib/colaRegistros'
import type { Finca } from '../types/finca'
import type { Lote } from '../types/lote'
import type { Embolse } from '../types/embolse'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function RegistroEmbolsePage() {
  const { session } = useAuth()
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

  // El operario elige la semana calendario normal (la que está viviendo hoy),
  // pero el embolse de esa semana se hace con la cinta de la semana
  // SIGUIENTE (en la semana calendario 40 se usa la cinta de la semana 41).
  // Por eso todo lo que se guarda y el color mostrado usan "semana + 1", sin
  // que el operario tenga que calcularlo ni elegirlo aparte.
  const [semana, setSemana] = useState(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const semanaRegistro = sumarSemanas(anio, semana, 1)
  const [fincaSeleccionada, setFincaSeleccionada] = useState<string>('')

  // El perfil (y por lo tanto fincaUnicaOperador/fincasDisponibles) carga de
  // forma asíncrona; si todavía no estaba listo en el primer render, hay que
  // volver a decidir la finca una vez que sí lo esté, o el operario se queda
  // viendo "Selecciona una finca" aunque el selector ya muestre la suya.
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

  const { lotes, loading: loadingLotes } = useLotes()
  const anioEmbolses = anioEmbolsesDe(semanaRegistro.anio, semanaRegistro.semana)
  const { embolses, loading: loadingEmbolses, refetch } = useEmbolses({ anioEmbolses })

  const lotesFinca = useMemo(
    () => [...lotes.filter((l) => l.finca === fincaSeleccionada)].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })),
    [lotes, fincaSeleccionada],
  )

  const embolsePorLote = useMemo(() => {
    const m = new Map<string, Embolse>()
    for (const e of embolses) {
      if (e.anio === semanaRegistro.anio && e.semana === semanaRegistro.semana) m.set(e.lote_id, e)
    }
    return m
  }, [embolses, semanaRegistro.anio, semanaRegistro.semana])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null
  const color = colorCintaDe(semanaRegistro.anio, semanaRegistro.semana)
  const estilo = ESTILO_CINTA[color]

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Registro de embolse</h1>
      <p className="mb-6 text-sm text-gray-500">
        Reporta la primera y segunda vuelta de embolse de cada lote, igual al formato que ya manejas en la finca. El
        total se refleja solo en el menú Embolses — ahí ya no se edita a mano.
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

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Semana</span>
          <select
            value={semana}
            onChange={(e) => setSemana(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
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
            className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <div className="text-sm">
          <span className="mb-1 block text-gray-600">Cinta color (semana {semanaRegistro.semana})</span>
          <span
            className="inline-block rounded-lg px-3 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: estilo.bg, color: estilo.texto }}
          >
            {color.charAt(0) + color.slice(1).toLowerCase()}
          </span>
        </div>
      </div>
      <p className="mb-6 text-xs text-gray-400">
        El embolse de la semana {semana} se hace con la cinta de la semana {semanaRegistro.semana} — por eso el color y
        lo que guardes aquí quedan registrados en esa semana siguiente.
      </p>

      {loadingLotes || loadingEmbolses ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : !finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : lotesFinca.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Esta finca todavía no tiene lotes. Créalos en Catálogo → Lotes.
        </p>
      ) : (
        <TablaRegistro
          key={`${finca.nombre}-${anio}-${semana}`}
          finca={finca}
          lotes={lotesFinca}
          semana={semana}
          anioRegistro={semanaRegistro.anio}
          semanaRegistro={semanaRegistro.semana}
          embolsePorLote={embolsePorLote}
          userId={session?.user.id ?? ''}
          onGuardado={refetch}
        />
      )}
    </div>
  )
}

interface Campos {
  primera: string
  segunda: string
  debunching: string
}

function TablaRegistro({
  finca,
  lotes,
  semana,
  anioRegistro,
  semanaRegistro,
  embolsePorLote,
  userId,
  onGuardado,
}: {
  finca: Finca
  lotes: Lote[]
  semana: number
  anioRegistro: number
  semanaRegistro: number
  embolsePorLote: Map<string, Embolse>
  userId: string
  onGuardado: () => void
}) {
  const [borrador, setBorrador] = useState<Record<string, Campos>>(() => {
    const inicial: Record<string, Campos> = {}
    for (const l of lotes) {
      const e = embolsePorLote.get(l.id)
      inicial[l.id] = {
        primera: e?.primera_vuelta != null ? String(e.primera_vuelta) : '',
        segunda: e?.segunda_vuelta != null ? String(e.segunda_vuelta) : '',
        debunching: e?.debunching != null ? String(e.debunching) : '',
      }
    }
    return inicial
  })
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [conError, setConError] = useState<Record<string, string>>({})

  function campo(loteId: string): Campos {
    return borrador[loteId] ?? { primera: '', segunda: '', debunching: '' }
  }

  function totalDe(loteId: string) {
    const { primera, segunda } = campo(loteId)
    return (Number(primera) || 0) + (Number(segunda) || 0)
  }

  function bllPorHasDe(lote: Lote) {
    const total = totalDe(lote.id)
    if (!lote.hectareas) return null
    return total / lote.hectareas
  }

  const totalSemana = lotes.reduce((sum, l) => sum + totalDe(l.id), 0)
  const totalHas = lotes.reduce((sum, l) => sum + (l.hectareas ?? 0), 0)
  const totalDebunching = lotes.reduce((sum, l) => sum + (Number(campo(l.id).debunching) || 0), 0)

  async function guardar(loteId: string, siguiente: Campos) {
    const primera = siguiente.primera.trim() === '' ? null : Number(siguiente.primera)
    const segunda = siguiente.segunda.trim() === '' ? null : Number(siguiente.segunda)
    const debunching = siguiente.debunching.trim() === '' ? null : Number(siguiente.debunching)
    if ([primera, segunda, debunching].some((v) => v !== null && (Number.isNaN(v) || v < 0))) {
      setConError((prev) => ({ ...prev, [loteId]: 'Cantidad inválida' }))
      return
    }

    setGuardando((prev) => new Set(prev).add(loteId))
    setConError((prev) => {
      const { [loteId]: _quitado, ...resto } = prev
      return resto
    })
    try {
      const cantidad = (primera ?? 0) + (segunda ?? 0)
      const { error } = await conLimite(
        supabase.from('embolses').upsert(
          {
            lote_id: loteId,
            anio: anioRegistro,
            semana: semanaRegistro,
            cantidad,
            primera_vuelta: primera,
            segunda_vuelta: segunda,
            debunching,
            user_id: userId,
          },
          { onConflict: 'lote_id,anio,semana' },
        ),
        LIMITE_ENVIO_MS,
      )
      if (error) throw error
      onGuardado()
    } catch (err) {
      setConError((prev) => ({ ...prev, [loteId]: err instanceof Error ? err.message : 'No se pudo guardar' }))
    } finally {
      setGuardando((prev) => {
        const siguienteSet = new Set(prev)
        siguienteSet.delete(loteId)
        return siguienteSet
      })
    }
  }

  function actualizarCampo(loteId: string, campoNombre: keyof Campos, valor: string) {
    setBorrador((prev) => ({ ...prev, [loteId]: { ...campo(loteId), [campoNombre]: valor } }))
  }

  function inputClass(loteId: string) {
    const base =
      'w-20 rounded-md border px-2 py-1 text-center text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-50'
    return conError[loteId]
      ? `${base} border-red-400 bg-red-50`
      : `${base} border-gray-200 bg-gray-50 focus:border-banex-500 focus:bg-white`
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-banex-800">
        {finca.nombre}
        {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>} · Semana{' '}
        {semana} · se registra en semana {semanaRegistro}/{anioRegistro}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="py-2 pr-3 pl-4 font-medium">Lote</th>
              <th className="px-2 py-2 text-center font-medium">Has</th>
              <th className="px-2 py-2 text-center font-medium">1ra VTA</th>
              <th className="px-2 py-2 text-center font-medium">2da VTA</th>
              <th className="px-2 py-2 text-center font-medium">Total</th>
              <th className="px-2 py-2 text-center font-medium">BLL/HAS</th>
              <th className="px-2 py-2 text-center font-medium">Debunching</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => {
              const c = campo(l.id)
              const bll = bllPorHasDe(l)
              return (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 pl-4 font-medium text-gray-900">{l.nombre}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">
                    {l.hectareas != null ? l.hectareas.toLocaleString('es') : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.primera}
                      disabled={guardando.has(l.id)}
                      onChange={(e) => actualizarCampo(l.id, 'primera', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), primera: e.target.value })}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.segunda}
                      disabled={guardando.has(l.id)}
                      onChange={(e) => actualizarCampo(l.id, 'segunda', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), segunda: e.target.value })}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold text-banex-800">{totalDe(l.id).toLocaleString('es')}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{bll != null ? bll.toFixed(1) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.debunching}
                      disabled={guardando.has(l.id)}
                      onChange={(e) => actualizarCampo(l.id, 'debunching', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), debunching: e.target.value })}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
              <td className="py-1.5 pr-3 pl-4">TOTAL</td>
              <td className="px-2 py-1.5 text-center">{totalHas.toLocaleString('es', { maximumFractionDigits: 2 })}</td>
              <td className="px-2 py-1.5 text-center">
                {lotes.reduce((sum, l) => sum + (Number(campo(l.id).primera) || 0), 0).toLocaleString('es')}
              </td>
              <td className="px-2 py-1.5 text-center">
                {lotes.reduce((sum, l) => sum + (Number(campo(l.id).segunda) || 0), 0).toLocaleString('es')}
              </td>
              <td className="px-2 py-1.5 text-center">{totalSemana.toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{totalHas > 0 ? (totalSemana / totalHas).toFixed(1) : '—'}</td>
              <td className="px-2 py-1.5 text-center">{totalDebunching.toLocaleString('es')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Object.entries(conError).length > 0 && (
        <p className="mt-2 text-sm text-red-600">
          {Object.values(conError)[0]}
        </p>
      )}
    </div>
  )
}

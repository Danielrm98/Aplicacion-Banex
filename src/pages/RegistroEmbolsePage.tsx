import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'
import { BANEX_LOGO_URL } from '../lib/logo'
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
import { conLimite } from '../lib/promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from '../lib/colaRegistros'
import { agregarEmbolseACola, enviarEmbolse, type DiasEmbolse, type PayloadEmbolse } from '../lib/colaEmbolses'
import { useEmbolsesPendientes } from '../lib/useEmbolsesPendientes'
import { manejarFlechasCelda } from '../lib/navegacionGrid'
import type { Finca } from '../types/finca'
import type { Lote } from '../types/lote'

type DatosGuardados = DiasEmbolse & { debunching: number | null }

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
  const { embolses, loading: loadingEmbolses, refetchSilencioso } = useEmbolses({ anioEmbolses })
  const { pendientes, cargado: pendientesCargados, recargar: recargarPendientes } = useEmbolsesPendientes()

  const lotesFinca = useMemo(
    () => [...lotes.filter((l) => l.finca === fincaSeleccionada)].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })),
    [lotes, fincaSeleccionada],
  )

  // Lo guardado en el servidor, con encima lo que todavía está pendiente de
  // enviar desde este celular (más reciente que lo del servidor).
  const embolsePorLote = useMemo(() => {
    const m = new Map<string, DatosGuardados>()
    for (const e of embolses) {
      if (e.anio === semanaRegistro.anio && e.semana === semanaRegistro.semana) m.set(e.lote_id, e)
    }
    for (const p of pendientes) {
      if (p.payload.anio === semanaRegistro.anio && p.payload.semana === semanaRegistro.semana) m.set(p.payload.lote_id, p.payload)
    }
    return m
  }, [embolses, pendientes, semanaRegistro.anio, semanaRegistro.semana])

  const alGuardar = useCallback(() => {
    refetchSilencioso()
    recargarPendientes()
  }, [refetchSilencioso, recargarPendientes])

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

      {loadingLotes || loadingEmbolses || !pendientesCargados ? (
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
          anio={anio}
          anioRegistro={semanaRegistro.anio}
          semanaRegistro={semanaRegistro.semana}
          embolsePorLote={embolsePorLote}
          userId={session?.user.id ?? ''}
          onGuardado={alGuardar}
        />
      )}
    </div>
  )
}

interface Campos {
  lunes: string
  martes: string
  miercoles: string
  jueves: string
  viernes: string
  sabado: string
  debunching: string
}

const DIAS_1RA_VUELTA = ['lunes', 'martes', 'miercoles'] as const
const DIAS_2DA_VUELTA = ['jueves', 'viernes', 'sabado'] as const

function TablaRegistro({
  finca,
  lotes,
  semana,
  anio,
  anioRegistro,
  semanaRegistro,
  embolsePorLote,
  userId,
  onGuardado,
}: {
  finca: Finca
  lotes: Lote[]
  semana: number
  anio: number
  anioRegistro: number
  semanaRegistro: number
  embolsePorLote: Map<string, DatosGuardados>
  userId: string
  onGuardado: () => void
}) {
  const color = colorCintaDe(anioRegistro, semanaRegistro)
  const estilo = ESTILO_CINTA[color]
  const [borrador, setBorrador] = useState<Record<string, Campos>>(() => {
    const inicial: Record<string, Campos> = {}
    for (const l of lotes) {
      const e = embolsePorLote.get(l.id)
      inicial[l.id] = {
        lunes: e?.lunes != null ? String(e.lunes) : '',
        martes: e?.martes != null ? String(e.martes) : '',
        miercoles: e?.miercoles != null ? String(e.miercoles) : '',
        jueves: e?.jueves != null ? String(e.jueves) : '',
        viernes: e?.viernes != null ? String(e.viernes) : '',
        sabado: e?.sabado != null ? String(e.sabado) : '',
        debunching: e?.debunching != null ? String(e.debunching) : '',
      }
    }
    return inicial
  })
  const [conError, setConError] = useState<Record<string, string>>({})
  const capturaRef = useRef<HTMLDivElement>(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [errorCompartir, setErrorCompartir] = useState<string | null>(null)

  function campo(loteId: string): Campos {
    return borrador[loteId] ?? { lunes: '', martes: '', miercoles: '', jueves: '', viernes: '', sabado: '', debunching: '' }
  }

  function sumaDias(loteId: string, dias: readonly (keyof Campos)[]) {
    const c = campo(loteId)
    return dias.reduce((sum, dia) => sum + (Number(c[dia]) || 0), 0)
  }

  function primeraDe(loteId: string) {
    return sumaDias(loteId, DIAS_1RA_VUELTA)
  }

  function segundaDe(loteId: string) {
    return sumaDias(loteId, DIAS_2DA_VUELTA)
  }

  function totalDe(loteId: string) {
    return primeraDe(loteId) + segundaDe(loteId)
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
    const dias = [...DIAS_1RA_VUELTA, ...DIAS_2DA_VUELTA] as const
    const valores: Record<(typeof dias)[number], number | null> = {} as Record<(typeof dias)[number], number | null>
    for (const dia of dias) {
      valores[dia] = siguiente[dia].trim() === '' ? null : Number(siguiente[dia])
    }
    const debunching = siguiente.debunching.trim() === '' ? null : Number(siguiente.debunching)
    if ([...Object.values(valores), debunching].some((v) => v !== null && (Number.isNaN(v) || v < 0))) {
      setConError((prev) => ({ ...prev, [loteId]: 'Cantidad inválida' }))
      return
    }

    setConError((prev) => {
      const { [loteId]: _quitado, ...resto } = prev
      return resto
    })
    const primera = DIAS_1RA_VUELTA.reduce((sum, dia) => sum + (valores[dia] ?? 0), 0)
    const segunda = DIAS_2DA_VUELTA.reduce((sum, dia) => sum + (valores[dia] ?? 0), 0)
    const payload: PayloadEmbolse = {
      lote_id: loteId,
      anio: anioRegistro,
      semana: semanaRegistro,
      cantidad: primera + segunda,
      primera_vuelta: primera,
      segunda_vuelta: segunda,
      debunching,
      user_id: userId,
      ...valores,
    }

    // Sin señal (o con señal tan débil que la petición no termina) el registro
    // queda guardado en el celular y se envía solo cuando vuelva la conexión.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await agregarEmbolseACola(payload)
      onGuardado()
      return
    }
    try {
      await conLimite(enviarEmbolse(payload), LIMITE_ENVIO_MS)
      onGuardado()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarEmbolseACola(payload)
        onGuardado()
      } else {
        setConError((prev) => ({ ...prev, [loteId]: err instanceof Error ? err.message : 'No se pudo guardar' }))
      }
    }
  }

  function actualizarCampo(loteId: string, campoNombre: keyof Campos, valor: string) {
    setBorrador((prev) => ({
      ...prev,
      [loteId]: { ...(prev[loteId] ?? campo(loteId)), [campoNombre]: valor },
    }))
  }

  async function compartirEmbolse() {
    if (!capturaRef.current) return
    setErrorCompartir(null)
    setCompartiendo(true)
    try {
      const { scrollWidth, scrollHeight } = capturaRef.current
      const blob = await domToBlob(capturaRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        width: scrollWidth,
        height: scrollHeight,
        style: { width: `${scrollWidth}px`, maxWidth: 'none' },
      })
      const nombreArchivo = `embolse_${finca.nombre}_semana${semanaRegistro}_${anioRegistro}.png`.replace(/\s+/g, '_')
      const file = new File([blob], nombreArchivo, { type: 'image/png' })
      const texto = `*REGISTRO DE EMBOLSE*\n*FINCA:* ${finca.nombre}\n*SEMANA:* ${semana}/${anio}`
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Registro de embolse', text: texto })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = nombreArchivo
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setErrorCompartir(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
      }
    } finally {
      setCompartiendo(false)
    }
  }

  function inputClass(loteId: string) {
    const base =
      'w-full min-w-0 rounded-md border px-1.5 py-1 text-center text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-50'
    return conError[loteId]
      ? `${base} border-red-400 bg-red-50`
      : `${base} border-gray-200 bg-gray-50 focus:border-banex-500 focus:bg-white`
  }

  return (
    <div className="relative">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-banex-800">
        <span>
          {finca.nombre}
          {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>} · Semana{' '}
          {semana}/{anio}
        </span>
        <span
          className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
          style={{ backgroundColor: estilo.bg, color: estilo.texto }}
        >
          Cinta {color.charAt(0) + color.slice(1).toLowerCase()} (semana {semanaRegistro})
        </span>
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-[1020px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="sticky left-0 z-10 w-[120px] border-r border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">Lote</th>
              <th className="sticky left-[120px] z-10 w-[70px] border-r border-gray-200 bg-gray-50 px-2 py-2 text-center font-medium">Has</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Lunes</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Martes</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Miércoles</th>
              <th className="w-[80px] px-2 py-2 text-center font-medium">1ra VTA</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Jueves</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Viernes</th>
              <th className="w-[70px] px-2 py-2 text-center font-medium">Sábado</th>
              <th className="w-[80px] px-2 py-2 text-center font-medium">2da VTA</th>
              <th className="w-[80px] px-2 py-2 text-center font-medium">Total</th>
              <th className="w-[80px] px-2 py-2 text-center font-medium">BLL/HAS</th>
              <th className="w-[90px] px-2 py-2 text-center font-medium">Debunching</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l, fila) => {
              const c = campo(l.id)
              const bll = bllPorHasDe(l)
              return (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">{l.nombre}</td>
                  <td className="sticky left-[120px] z-10 border-r border-gray-200 bg-white px-2 py-1.5 text-center text-gray-500">
                    {l.hectareas != null ? l.hectareas.toLocaleString('es') : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.lunes}
                      onChange={(e) => actualizarCampo(l.id, 'lunes', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), lunes: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 0)}
                      data-fila={fila}
                      data-col={0}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.martes}
                      onChange={(e) => actualizarCampo(l.id, 'martes', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), martes: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 1)}
                      data-fila={fila}
                      data-col={1}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.miercoles}
                      onChange={(e) => actualizarCampo(l.id, 'miercoles', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), miercoles: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 2)}
                      data-fila={fila}
                      data-col={2}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold text-banex-800">{primeraDe(l.id).toLocaleString('es')}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.jueves}
                      onChange={(e) => actualizarCampo(l.id, 'jueves', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), jueves: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 3)}
                      data-fila={fila}
                      data-col={3}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.viernes}
                      onChange={(e) => actualizarCampo(l.id, 'viernes', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), viernes: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 4)}
                      data-fila={fila}
                      data-col={4}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.sabado}
                      onChange={(e) => actualizarCampo(l.id, 'sabado', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), sabado: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 5)}
                      data-fila={fila}
                      data-col={5}
                      title={conError[l.id]}
                      className={inputClass(l.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold text-banex-800">{segundaDe(l.id).toLocaleString('es')}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-banex-800">{totalDe(l.id).toLocaleString('es')}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{bll != null ? bll.toFixed(1) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={c.debunching}
                      onChange={(e) => actualizarCampo(l.id, 'debunching', e.target.value)}
                      onBlur={(e) => guardar(l.id, { ...campo(l.id), debunching: e.target.value })}
                      onKeyDown={(e) => manejarFlechasCelda(e, fila, 6)}
                      data-fila={fila}
                      data-col={6}
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
              <td className="sticky left-0 z-10 border-r border-banex-100 bg-banex-50 py-1.5 pr-3 pl-4">TOTAL</td>
              <td className="sticky left-[120px] z-10 border-r border-banex-100 bg-banex-50 px-2 py-1.5 text-center">
                {totalHas.toLocaleString('es', { maximumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).lunes) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).martes) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).miercoles) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + primeraDe(l.id), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).jueves) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).viernes) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).sabado) || 0), 0).toLocaleString('es')}</td>
              <td className="px-2 py-1.5 text-center">{lotes.reduce((sum, l) => sum + segundaDe(l.id), 0).toLocaleString('es')}</td>
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

      <div className="mt-4">
        <button
          onClick={compartirEmbolse}
          disabled={compartiendo}
          className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1fb959] disabled:opacity-60"
        >
          {compartiendo ? 'Generando imagen...' : 'Compartir embolse'}
        </button>
        {errorCompartir && <p className="mt-2 text-sm text-red-600">{errorCompartir}</p>}
      </div>

      {/* Fuera de pantalla: una versión de solo texto de la tabla (sin <input>, cuyo
          valor no queda reflejado al capturar la pantalla) que se convierte en la
          imagen para compartir por WhatsApp. */}
      <div className="pointer-events-none absolute top-0 -left-[9999px]">
        <div ref={capturaRef} className="w-[1180px] rounded-lg bg-white p-6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-gray-100 pb-3.5">
            <img src={BANEX_LOGO_URL} alt="BANEX S.A." className="h-11 w-11 shrink-0 rounded-md object-contain" />
            <div>
              <p className="text-base font-bold text-banex-900">ApproBan</p>
              <p className="text-sm text-gray-500">Registro de embolse</p>
            </div>
          </div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-banex-800">
              {finca.nombre}
              {finca.hectareas != null && <span className="ml-2 text-base font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="text-base font-medium text-gray-600">Semana {semana}/{anio}</span>
              <span
                className="inline-block rounded-md px-3 py-1 text-sm font-semibold whitespace-nowrap"
                style={{ backgroundColor: estilo.bg, color: estilo.texto }}
              >
                Cinta {color.charAt(0) + color.slice(1).toLowerCase()}
              </span>
            </div>
          </div>
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-3 pr-3 pl-4 font-medium">Lote</th>
                <th className="px-2 py-3 text-center font-medium">Has</th>
                <th className="px-2 py-3 text-center font-medium">Lunes</th>
                <th className="px-2 py-3 text-center font-medium">Martes</th>
                <th className="px-2 py-3 text-center font-medium">Miércoles</th>
                <th className="px-2 py-3 text-center font-medium">1ra VTA</th>
                <th className="px-2 py-3 text-center font-medium">Jueves</th>
                <th className="px-2 py-3 text-center font-medium">Viernes</th>
                <th className="px-2 py-3 text-center font-medium">Sábado</th>
                <th className="px-2 py-3 text-center font-medium">2da VTA</th>
                <th className="px-2 py-3 text-center font-medium">Total</th>
                <th className="px-2 py-3 text-center font-medium">BLL/HAS</th>
                <th className="px-2 py-3 text-center font-medium">Debunching</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => {
                const c = campo(l.id)
                const bll = bllPorHasDe(l)
                return (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-900">{l.nombre}</td>
                    <td className="px-2 py-2.5 text-center text-gray-500">{l.hectareas != null ? l.hectareas.toLocaleString('es') : '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.lunes || '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.martes || '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.miercoles || '—'}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-banex-800">{primeraDe(l.id).toLocaleString('es')}</td>
                    <td className="px-2 py-2.5 text-center">{c.jueves || '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.viernes || '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.sabado || '—'}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-banex-800">{segundaDe(l.id).toLocaleString('es')}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-banex-800">{totalDe(l.id).toLocaleString('es')}</td>
                    <td className="px-2 py-2.5 text-center text-gray-500">{bll != null ? bll.toFixed(1) : '—'}</td>
                    <td className="px-2 py-2.5 text-center">{c.debunching || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                <td className="py-2.5 pr-3 pl-4">TOTAL</td>
                <td className="px-2 py-2.5 text-center">{totalHas.toLocaleString('es', { maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).lunes) || 0), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).martes) || 0), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">
                  {lotes.reduce((sum, l) => sum + (Number(campo(l.id).miercoles) || 0), 0).toLocaleString('es')}
                </td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + primeraDe(l.id), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).jueves) || 0), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).viernes) || 0), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + (Number(campo(l.id).sabado) || 0), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{lotes.reduce((sum, l) => sum + segundaDe(l.id), 0).toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{totalSemana.toLocaleString('es')}</td>
                <td className="px-2 py-2.5 text-center">{totalHas > 0 ? (totalSemana / totalHas).toFixed(1) : '—'}</td>
                <td className="px-2 py-2.5 text-center">{totalDebunching.toLocaleString('es')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

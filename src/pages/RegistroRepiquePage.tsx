import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'
import { BANEX_LOGO_URL } from '../lib/logo'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { useRepiques } from '../lib/useRepiques'
import { anioEmbolsesDe } from '../lib/anioEmbolses'
import { colorCintaDe, semanaEmbolseDeEdad, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { conLimite } from '../lib/promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from '../lib/colaRegistros'
import { agregarRepiqueACola, enviarRepique } from '../lib/colaRepiques'
import { useRepiquesPendientes } from '../lib/useRepiquesPendientes'
import type { RepiqueInput } from '../types/repique'
import type { Finca } from '../types/finca'
import type { Lote } from '../types/lote'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)
// El repique se reporta hasta con esta cantidad de semanas de edad; de sobra
// para cubrir el ciclo normal de cosecha (12 semanas) con margen.
const EDADES = Array.from({ length: 16 }, (_, i) => i + 1)

export default function RegistroRepiquePage() {
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

  const [semana, setSemana] = useState(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [fincaSeleccionada, setFincaSeleccionada] = useState<string>('')

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
  const anioEmbolses = anioEmbolsesDe(anio, semana)
  const { embolses, loading: loadingEmbolses } = useEmbolses({ anioEmbolses })
  const { repiques, loading: loadingRepiques, refetchSilencioso } = useRepiques({ anioEmbolses })
  const { pendientes, cargado: pendientesCargados, recargar: recargarPendientes } = useRepiquesPendientes()

  const lotesFinca = useMemo(
    () => [...lotes.filter((l) => l.finca === fincaSeleccionada)].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })),
    [lotes, fincaSeleccionada],
  )

  const alGuardar = useCallback(() => {
    refetchSilencioso()
    recargarPendientes()
  }, [refetchSilencioso, recargarPendientes])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Registro de repique</h1>
      <p className="mb-6 text-sm text-gray-500">
        Reporta, por lote y por la edad en semanas que tenían los racimos al momento del repique, cuántos se
        descartaron (viento, lluvia, problemas fisiológicos). Esto descuenta solo el inventario calculado en el menú
        Repiques — el conteo original de Embolses no se modifica.
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
          <span className="mb-1 block text-gray-600">Semana en que se repica</span>
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
      </div>

      {loadingLotes || loadingEmbolses || loadingRepiques || !pendientesCargados ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : !finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : lotesFinca.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Esta finca todavía no tiene lotes. Créalos en Catálogo → Lotes.
        </p>
      ) : (
        <TablaRepique
          key={`${finca.nombre}-${anio}-${semana}`}
          finca={finca}
          lotes={lotesFinca}
          semana={semana}
          anio={anio}
          embolses={embolses}
          repiques={repiques}
          pendientes={pendientes}
          userId={session?.user.id ?? ''}
          onGuardado={alGuardar}
        />
      )}
    </div>
  )
}

interface CeldaInfo {
  edad: number
  anioEmbolse: number
  semanaEmbolse: number
  color: ReturnType<typeof colorCintaDe>
  embolsado: number
  yaRepicado: number
}

function TablaRepique({
  finca,
  lotes,
  semana,
  anio,
  embolses,
  repiques,
  pendientes,
  userId,
  onGuardado,
}: {
  finca: Finca
  lotes: Lote[]
  semana: number
  anio: number
  embolses: { lote_id: string; anio: number; semana: number; cantidad: number }[]
  repiques: { lote_id: string; anio_embolse: number; semana_embolse: number; cantidad: number }[]
  pendientes: { payload: RepiqueInput }[]
  userId: string
  onGuardado: () => void
}) {
  const columnas: CeldaInfo[] = useMemo(
    () =>
      EDADES.map((edad) => {
        const { anio: anioEmbolse, semana: semanaEmbolse } = semanaEmbolseDeEdad(anio, semana, edad)
        return {
          edad,
          anioEmbolse,
          semanaEmbolse,
          color: colorCintaDe(anioEmbolse, semanaEmbolse),
          embolsado: 0,
          yaRepicado: 0,
        }
      }),
    [anio, semana],
  )

  function datosCelda(loteId: string, info: CeldaInfo) {
    const embolsado =
      embolses.find((e) => e.lote_id === loteId && e.anio === info.anioEmbolse && e.semana === info.semanaEmbolse)
        ?.cantidad ?? 0
    const repicadoServidor =
      repiques.find(
        (r) => r.lote_id === loteId && r.anio_embolse === info.anioEmbolse && r.semana_embolse === info.semanaEmbolse,
      )?.cantidad ?? 0
    const repicadoPendiente = pendientes.find(
      (p) =>
        p.payload.lote_id === loteId &&
        p.payload.anio_embolse === info.anioEmbolse &&
        p.payload.semana_embolse === info.semanaEmbolse,
    )?.payload.cantidad
    return { embolsado, yaRepicado: repicadoPendiente ?? repicadoServidor }
  }

  const [borrador, setBorrador] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    for (const l of lotes) {
      for (const c of columnas) {
        const { yaRepicado } = datosCelda(l.id, c)
        inicial[`${l.id}_${c.edad}`] = yaRepicado > 0 ? String(yaRepicado) : ''
      }
    }
    return inicial
  })
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [conError, setConError] = useState<Record<string, string>>({})
  const capturaRef = useRef<HTMLDivElement>(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [errorCompartir, setErrorCompartir] = useState<string | null>(null)

  function valorDe(loteId: string, edad: number) {
    return borrador[`${loteId}_${edad}`] ?? ''
  }

  function totalLote(loteId: string) {
    return columnas.reduce((sum, c) => sum + (Number(valorDe(loteId, c.edad)) || 0), 0)
  }

  const totalGeneral = lotes.reduce((sum, l) => sum + totalLote(l.id), 0)

  async function guardarCelda(lote: Lote, info: CeldaInfo, valorTexto: string) {
    const clave = `${lote.id}_${info.edad}`
    const cantidad = valorTexto.trim() === '' ? 0 : Number(valorTexto)
    if (Number.isNaN(cantidad) || cantidad < 0) {
      setConError((prev) => ({ ...prev, [clave]: 'Cantidad inválida' }))
      return
    }
    const { yaRepicado } = datosCelda(lote.id, info)
    if (cantidad === yaRepicado) return

    setGuardando((prev) => new Set(prev).add(clave))
    setConError((prev) => {
      const { [clave]: _quitado, ...resto } = prev
      return resto
    })

    const payload: RepiqueInput = {
      lote_id: lote.id,
      anio_embolse: info.anioEmbolse,
      semana_embolse: info.semanaEmbolse,
      edad_semanas: info.edad,
      cantidad,
      user_id: userId,
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await agregarRepiqueACola(payload)
      onGuardado()
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
      return
    }
    try {
      await conLimite(enviarRepique(payload), LIMITE_ENVIO_MS)
      onGuardado()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarRepiqueACola(payload)
        onGuardado()
      } else {
        setConError((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : 'No se pudo guardar' }))
      }
    } finally {
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
    }
  }

  async function compartirRepique() {
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
      const nombreArchivo = `repique_${finca.nombre}_semana${semana}_${anio}.png`.replace(/\s+/g, '_')
      const file = new File([blob], nombreArchivo, { type: 'image/png' })
      const texto = `*REGISTRO DE REPIQUE*\n*FINCA:* ${finca.nombre}\n*SEMANA:* ${semana}/${anio}`
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Registro de repique', text: texto })
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

  function inputClass(clave: string) {
    const base =
      'w-full min-w-0 rounded-md border px-1 py-1 text-center text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-50'
    return conError[clave]
      ? `${base} border-red-400 bg-red-50`
      : `${base} border-gray-200 bg-gray-50 focus:border-banex-500 focus:bg-white`
  }

  return (
    <div className="relative">
      <h2 className="mb-3 text-sm font-semibold text-banex-800">
        {finca.nombre}
        {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>} · Semana {semana}/{anio}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="border-collapse text-sm" style={{ width: `${160 + columnas.length * 72}px` }}>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="sticky left-0 z-10 w-[160px] border-r border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">Lote</th>
              {columnas.map((c) => {
                const estilo = ESTILO_CINTA[c.color]
                return (
                  <th
                    key={c.edad}
                    className="w-[72px] border-r border-gray-100 px-1 py-1.5 text-center font-medium"
                    title={`Semana ${c.semanaEmbolse}/${c.anioEmbolse}`}
                  >
                    <div>Edad {c.edad}</div>
                    <div
                      className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: estilo.bg, color: estilo.texto }}
                    >
                      {c.color.charAt(0) + c.color.slice(1).toLowerCase()}
                    </div>
                  </th>
                )
              })}
              <th className="w-[90px] border-l-2 border-banex-100 bg-gray-100 px-2 py-2 text-center font-medium">Total lote</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                  {l.nombre}
                </td>
                {columnas.map((c) => {
                  const clave = `${l.id}_${c.edad}`
                  const { embolsado, yaRepicado } = datosCelda(l.id, c)
                  const disponible = embolsado - yaRepicado
                  return (
                    <td key={clave} className="border-r border-gray-100 p-0.5 text-center">
                      <input
                        type="number"
                        min={0}
                        value={valorDe(l.id, c.edad)}
                        onChange={(e) => setBorrador((prev) => ({ ...prev, [clave]: e.target.value }))}
                        onBlur={(e) => guardarCelda(l, c, e.target.value)}
                        disabled={guardando.has(clave)}
                        title={conError[clave]}
                        className={inputClass(clave)}
                      />
                      <p className="mt-0.5 text-[10px] text-gray-400">{embolsado > 0 ? `disp. ${disponible}` : ''}</p>
                    </td>
                  )
                })}
                <td className="border-l-2 border-banex-100 bg-banex-50/40 px-2 py-1.5 text-center font-semibold text-banex-800">
                  {totalLote(l.id).toLocaleString('es')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
              <td className="sticky left-0 z-10 border-r border-banex-100 bg-banex-50 py-1.5 pr-3 pl-4">TOTAL</td>
              {columnas.map((c) => (
                <td key={c.edad} className="border-r border-banex-50 px-1 py-1.5 text-center">
                  {lotes.reduce((sum, l) => sum + (Number(valorDe(l.id, c.edad)) || 0), 0).toLocaleString('es')}
                </td>
              ))}
              <td className="border-l-2 border-banex-100 bg-banex-100/60 px-2 py-1.5 text-center">
                {totalGeneral.toLocaleString('es')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Object.entries(conError).length > 0 && <p className="mt-2 text-sm text-red-600">{Object.values(conError)[0]}</p>}

      <div className="mt-4">
        <button
          onClick={compartirRepique}
          disabled={compartiendo}
          className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1fb959] disabled:opacity-60"
        >
          {compartiendo ? 'Generando imagen...' : 'Compartir repique'}
        </button>
        {errorCompartir && <p className="mt-2 text-sm text-red-600">{errorCompartir}</p>}
      </div>

      <div className="pointer-events-none absolute top-0 -left-[9999px]">
        <div ref={capturaRef} className="rounded-lg bg-white p-6" style={{ width: `${640 + columnas.length * 72}px` }}>
          <div className="mb-4 flex items-center gap-2.5 border-b border-gray-100 pb-3.5">
            <img src={BANEX_LOGO_URL} alt="BANEX S.A." className="h-11 w-11 shrink-0 rounded-md object-contain" />
            <div>
              <p className="text-base font-bold text-banex-900">ApproBan</p>
              <p className="text-sm text-gray-500">Registro de repique</p>
            </div>
          </div>
          <h2 className="mb-4 text-lg font-semibold text-banex-800">
            {finca.nombre}
            {finca.hectareas != null && <span className="ml-2 text-base font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>}
            <span className="ml-3 text-base font-normal text-gray-600">Semana {semana}/{anio}</span>
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-2 pr-3 pl-4 font-medium">Lote</th>
                {columnas.map((c) => (
                  <th key={c.edad} className="px-1 py-2 text-center font-medium">
                    Edad {c.edad}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 pl-4 font-medium text-gray-900">{l.nombre}</td>
                  {columnas.map((c) => (
                    <td key={c.edad} className="px-1 py-2 text-center">
                      {valorDe(l.id, c.edad) || '—'}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-semibold text-banex-800">{totalLote(l.id).toLocaleString('es')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

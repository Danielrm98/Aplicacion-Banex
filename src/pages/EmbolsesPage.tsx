import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { semanasDelAnioEmbolses, anioEmbolsesDe, type SemanaReal } from '../lib/anioEmbolses'
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

const OPCION_TODAS = '__todas__'
const SIN_EMPRESA = 'Sin empresa asignada'

function claveSemana(anio: number, semana: number) {
  return `${anio}_${semana}`
}

export default function EmbolsesPage() {
  const { session } = useAuth()
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

  const [anioEmbolses, setAnioEmbolses] = useState(() =>
    anioEmbolsesDe(new Date().getFullYear(), getIsoWeek(fechaLocalHoy())),
  )
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
    if (fincaSeleccionada && (fincaSeleccionada === OPCION_TODAS || fincasDisponibles.some((f) => f.nombre === fincaSeleccionada))) return
    const guardada = obtenerFincaActual()
    if (guardada && fincasDisponibles.some((f) => f.nombre === guardada)) setFincaSeleccionada(guardada)
    else if (esAdmin) setFincaSeleccionada(OPCION_TODAS)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada, esAdmin])

  const { lotes, loading: loadingLotes } = useLotes()
  const { embolses, loading: loadingEmbolses, refetchSilencioso: refetchEmbolses } = useEmbolses({ anioEmbolses })

  const semanas = useMemo(() => semanasDelAnioEmbolses(anioEmbolses), [anioEmbolses])

  const porLote = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const e of embolses) {
      if (!m.has(e.lote_id)) m.set(e.lote_id, new Map())
      m.get(e.lote_id)!.set(claveSemana(e.anio, e.semana), e.cantidad)
    }
    return m
  }, [embolses])

  const lotesPorFinca = useMemo(() => {
    const m = new Map<string, Lote[]>()
    for (const l of lotes) {
      if (!m.has(l.finca)) m.set(l.finca, [])
      m.get(l.finca)!.push(l)
    }
    return m
  }, [lotes])

  function cantidadLote(loteId: string, s: SemanaReal): number {
    return porLote.get(loteId)?.get(claveSemana(s.anio, s.semana)) ?? 0
  }

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    if (nombre !== OPCION_TODAS) guardarFincaActual(nombre)
  }

  const mostrarResumen = esAdmin && fincaSeleccionada === OPCION_TODAS
  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Embolses</h1>
      <p className="mb-6 text-sm text-gray-500">
        Racimos embolsados por semana, por lote y finca. El color de cada semana es el de la cinta con la que se
        marcan esos racimos en el campo.
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
            {esAdmin && <option value={OPCION_TODAS}>Todas las fincas (resumen)</option>}
            {fincasOrdenadas.map((f) => (
              <option key={f.nombre} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Año de embolses</span>
          <input
            type="number"
            value={anioEmbolses}
            onChange={(e) => setAnioEmbolses(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <p className="text-xs text-gray-400">
          Va de la semana 42/{anioEmbolses - 1} a la semana 52/{anioEmbolses}.
        </p>
      </div>

      {loadingLotes || loadingEmbolses ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : mostrarResumen ? (
        <ResumenGeneral fincas={fincasOrdenadas} lotesPorFinca={lotesPorFinca} semanas={semanas} cantidadLote={cantidadLote} />
      ) : finca ? (
        <DetalleFinca
          key={`${finca.nombre}-${anioEmbolses}`}
          finca={finca}
          lotes={lotesPorFinca.get(finca.nombre) ?? []}
          semanas={semanas}
          cantidadLote={cantidadLote}
          userId={session?.user.id ?? ''}
          onGuardado={refetchEmbolses}
          soloLectura={!esAdmin}
        />
      ) : (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      )}
    </div>
  )
}

function EncabezadoSemana({ s }: { s: SemanaReal }) {
  const color = colorCintaDe(s.anio, s.semana)
  const estilo = ESTILO_CINTA[color]
  return (
    <th
      className="sticky top-0 z-[2] w-[56px] border border-gray-200 px-1.5 py-1.5 text-center font-medium"
      style={{ backgroundColor: estilo.bg, color: estilo.texto }}
      title={`Semana ${s.semana}/${s.anio} · Cinta ${color.charAt(0)}${color.slice(1).toLowerCase()}`}
    >
      {s.semana}
    </th>
  )
}

function ResumenGeneral({
  fincas,
  lotesPorFinca,
  semanas,
  cantidadLote,
}: {
  fincas: Finca[]
  lotesPorFinca: Map<string, Lote[]>
  semanas: SemanaReal[]
  cantidadLote: (loteId: string, s: SemanaReal) => number
}) {
  function totalFinca(finca: string, s: SemanaReal) {
    return (lotesPorFinca.get(finca) ?? []).reduce((sum, l) => sum + cantidadLote(l.id, s), 0)
  }

  const grupos = useMemo(() => {
    const porEmpresa = new Map<string, Finca[]>()
    for (const f of fincas) {
      const empresa = f.empresa || SIN_EMPRESA
      if (!porEmpresa.has(empresa)) porEmpresa.set(empresa, [])
      porEmpresa.get(empresa)!.push(f)
    }
    // El orden de aparición ya viene de `fincas` (ordenadas por posicionFinca),
    // así que basta con recorrer las empresas en el orden en que aparecieron.
    return Array.from(porEmpresa.entries())
  }, [fincas])

  function totalEmpresa(fincasEmpresa: Finca[], s: SemanaReal) {
    return fincasEmpresa.reduce((sum, f) => sum + totalFinca(f.nombre, s), 0)
  }

  function totalGeneral(s: SemanaReal) {
    return fincas.reduce((sum, f) => sum + totalFinca(f.nombre, s), 0)
  }

  function totalAnualFinca(finca: string) {
    return semanas.reduce((sum, s) => sum + totalFinca(finca, s), 0)
  }

  function totalAnualEmpresa(fincasEmpresa: Finca[]) {
    return semanas.reduce((sum, s) => sum + totalEmpresa(fincasEmpresa, s), 0)
  }

  function totalAnualGeneral() {
    return semanas.reduce((sum, s) => sum + totalGeneral(s), 0)
  }

  return (
    <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <th className="sticky top-0 left-0 z-[3] w-[160px] border border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">
              Finca
            </th>
            <th className="sticky top-0 left-[160px] z-[3] w-[70px] border border-gray-200 bg-gray-50 px-2 py-2 text-center font-medium">
              Has
            </th>
            {semanas.map((s) => (
              <EncabezadoSemana key={claveSemana(s.anio, s.semana)} s={s} />
            ))}
            <th className="sticky top-0 z-[2] w-[90px] border border-gray-200 bg-gray-100 px-2 py-2 text-center font-medium">
              Total año
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(([empresa, fincasEmpresa]) => (
            <GrupoEmpresa
              key={empresa}
              empresa={empresa}
              fincas={fincasEmpresa}
              semanas={semanas}
              totalFinca={totalFinca}
              totalEmpresa={totalEmpresa}
              totalAnualFinca={totalAnualFinca}
              totalAnualEmpresa={totalAnualEmpresa}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
            <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/50 py-1.5 pr-3 pl-4" colSpan={2}>
              Total general
            </td>
            {semanas.map((s) => (
              <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                {totalGeneral(s).toLocaleString('es')}
              </td>
            ))}
            <td className="border border-gray-200 bg-banex-100/60 px-2 py-1.5 text-center">
              {totalAnualGeneral().toLocaleString('es')}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function GrupoEmpresa({
  empresa,
  fincas,
  semanas,
  totalFinca,
  totalEmpresa,
  totalAnualFinca,
  totalAnualEmpresa,
}: {
  empresa: string
  fincas: Finca[]
  semanas: SemanaReal[]
  totalFinca: (finca: string, s: SemanaReal) => number
  totalEmpresa: (fincas: Finca[], s: SemanaReal) => number
  totalAnualFinca: (finca: string) => number
  totalAnualEmpresa: (fincas: Finca[]) => number
}) {
  return (
    <>
      {fincas.map((f) => (
        <tr key={f.nombre} className="border-b border-gray-100">
          <td className="sticky left-0 z-[1] border border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
            {f.nombre}
          </td>
          <td className="sticky left-[160px] z-[1] border border-gray-200 bg-white px-2 py-1.5 text-center text-gray-500">
            {f.hectareas != null ? f.hectareas.toLocaleString('es') : '—'}
          </td>
          {semanas.map((s) => (
            <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
              {totalFinca(f.nombre, s).toLocaleString('es')}
            </td>
          ))}
          <td className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-center font-semibold text-banex-800">
            {totalAnualFinca(f.nombre).toLocaleString('es')}
          </td>
        </tr>
      ))}
      <tr className="border-b-2 border-banex-100 bg-banex-50/40 font-semibold text-banex-800">
        <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/40 py-1.5 pr-3 pl-4" colSpan={2}>
          {empresa} - TOTAL
        </td>
        {semanas.map((s) => (
          <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
            {totalEmpresa(fincas, s).toLocaleString('es')}
          </td>
        ))}
        <td className="border border-gray-200 bg-banex-100/40 px-2 py-1.5 text-center">
          {totalAnualEmpresa(fincas).toLocaleString('es')}
        </td>
      </tr>
    </>
  )
}

function DetalleFinca({
  finca,
  lotes,
  semanas,
  cantidadLote,
  userId,
  onGuardado,
  soloLectura,
}: {
  finca: Finca
  lotes: Lote[]
  semanas: SemanaReal[]
  cantidadLote: (loteId: string, s: SemanaReal) => number
  userId: string
  onGuardado: () => void
  soloLectura: boolean
}) {
  const [borrador, setBorrador] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    for (const l of lotes) {
      for (const s of semanas) {
        const cantidad = cantidadLote(l.id, s)
        inicial[`${l.id}_${claveSemana(s.anio, s.semana)}`] = cantidad > 0 ? String(cantidad) : ''
      }
    }
    return inicial
  })
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [conError, setConError] = useState<Record<string, string>>({})

  function valorDe(loteId: string, s: SemanaReal) {
    return borrador[`${loteId}_${claveSemana(s.anio, s.semana)}`] ?? ''
  }

  function totalSemana(s: SemanaReal) {
    return lotes.reduce((sum, l) => sum + (Number(valorDe(l.id, s)) || 0), 0)
  }

  function totalAnualLote(loteId: string) {
    return semanas.reduce((sum, s) => sum + (Number(valorDe(loteId, s)) || 0), 0)
  }

  function totalAnualGeneral() {
    return semanas.reduce((sum, s) => sum + totalSemana(s), 0)
  }

  async function guardarCelda(loteId: string, s: SemanaReal, valorTexto: string) {
    const clave = `${loteId}_${claveSemana(s.anio, s.semana)}`
    const cantidad = valorTexto.trim() === '' ? 0 : Number(valorTexto)
    if (Number.isNaN(cantidad) || cantidad < 0) {
      setConError((prev) => ({ ...prev, [clave]: 'Cantidad inválida' }))
      return
    }
    if (cantidad === (cantidadLote(loteId, s) || 0)) return // sin cambios reales, no hace falta guardar

    setGuardando((prev) => new Set(prev).add(clave))
    setConError((prev) => {
      const { [clave]: _quitado, ...resto } = prev
      return resto
    })
    try {
      const { error } = await conLimite(
        supabase
          .from('embolses')
          .upsert({ lote_id: loteId, anio: s.anio, semana: s.semana, cantidad, user_id: userId }, { onConflict: 'lote_id,anio,semana' }),
        LIMITE_ENVIO_MS,
      )
      if (error) throw error
      onGuardado()
    } catch (err) {
      setConError((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : 'No se pudo guardar' }))
    } finally {
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-banex-800">
          {finca.nombre}
          {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>}
        </h2>
      </div>

      {soloLectura && (
        <p className="mb-3 text-xs text-gray-500">
          Esta tabla se actualiza sola con lo que se registre en Registro de embolse — aquí no se edita.
        </p>
      )}

      {lotes.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Esta finca todavía no tiene lotes. Créalos en Catálogo → Lotes.
        </p>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="sticky top-0 left-0 z-[3] w-[120px] border border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">
                  Lote
                </th>
                <th className="sticky top-0 left-[120px] z-[3] w-[70px] border border-gray-200 bg-gray-50 px-2 py-2 text-center font-medium">
                  Has
                </th>
                {semanas.map((s) => (
                  <EncabezadoSemana key={claveSemana(s.anio, s.semana)} s={s} />
                ))}
                <th className="sticky top-0 z-[2] w-[90px] border border-gray-200 bg-gray-100 px-2 py-2 text-center font-medium">
                  Total año
                </th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="sticky left-0 z-[1] border border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                    {l.nombre}
                  </td>
                  <td className="sticky left-[120px] z-[1] border border-gray-200 bg-white px-2 py-1.5 text-center text-gray-500">
                    {l.hectareas != null ? l.hectareas.toLocaleString('es') : '—'}
                  </td>
                  {semanas.map((s) => {
                    const clave = `${l.id}_${claveSemana(s.anio, s.semana)}`
                    return (
                      <td key={clave} className="border border-gray-200 p-0.5 text-center">
                        {soloLectura ? (
                          <span className="block py-1 text-xs text-gray-700">{valorDe(l.id, s) || '0'}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={valorDe(l.id, s)}
                            onChange={(e) => setBorrador((prev) => ({ ...prev, [clave]: e.target.value }))}
                            onBlur={(e) => guardarCelda(l.id, s, e.target.value)}
                            disabled={guardando.has(clave)}
                            title={conError[clave]}
                            className={`w-14 rounded border px-1 py-1 text-center text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-50 ${
                              conError[clave] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:border-banex-500 focus:bg-white'
                            }`}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-center font-semibold text-banex-800">
                    {totalAnualLote(l.id).toLocaleString('es')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/50 py-1.5 pr-3 pl-4" colSpan={2}>
                  TOTAL
                </td>
                {semanas.map((s) => (
                  <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                    {totalSemana(s).toLocaleString('es')}
                  </td>
                ))}
                <td className="border border-gray-200 bg-banex-100/60 px-2 py-1.5 text-center">
                  {totalAnualGeneral().toLocaleString('es')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

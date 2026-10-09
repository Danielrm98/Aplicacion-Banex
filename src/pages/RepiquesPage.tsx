import { Fragment, useEffect, useMemo, useState } from 'react'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { useRepiques } from '../lib/useRepiques'
import { semanasDelAnioEmbolses, anioEmbolsesDe, type SemanaReal } from '../lib/anioEmbolses'
import { colorCintaDe, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import type { Finca } from '../types/finca'
import type { Lote } from '../types/lote'

const OPCION_TODAS = '__todas__'
const SIN_EMPRESA = 'Sin empresa asignada'

function claveSemana(anio: number, semana: number) {
  return `${anio}_${semana}`
}

export default function RepiquesPage() {
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
  const { embolses, loading: loadingEmbolses } = useEmbolses({ anioEmbolses })
  const { repiques, loading: loadingRepiques } = useRepiques({ anioEmbolses })

  const semanas = useMemo(() => semanasDelAnioEmbolses(anioEmbolses), [anioEmbolses])

  const embolsadoPorLote = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const e of embolses) {
      if (!m.has(e.lote_id)) m.set(e.lote_id, new Map())
      m.get(e.lote_id)!.set(claveSemana(e.anio, e.semana), e.cantidad)
    }
    return m
  }, [embolses])

  // Varias semanas de reporte pueden tocar la misma semana de embolse
  // (la cinta va envejeciendo y cae en otra columna de edad cada semana),
  // así que se suma lo repicado de todas, no se queda solo con la última.
  const repicadoPorLote = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const r of repiques) {
      if (!m.has(r.lote_id)) m.set(r.lote_id, new Map())
      const porSemana = m.get(r.lote_id)!
      const clave = claveSemana(r.anio_embolse, r.semana_embolse)
      porSemana.set(clave, (porSemana.get(clave) ?? 0) + r.cantidad)
    }
    return m
  }, [repiques])

  const lotesPorFinca = useMemo(() => {
    const m = new Map<string, Lote[]>()
    for (const l of lotes) {
      if (!m.has(l.finca)) m.set(l.finca, [])
      m.get(l.finca)!.push(l)
    }
    return m
  }, [lotes])

  function embolsadoDe(loteId: string, s: SemanaReal): number {
    return embolsadoPorLote.get(loteId)?.get(claveSemana(s.anio, s.semana)) ?? 0
  }

  function repicadoDe(loteId: string, s: SemanaReal): number {
    return repicadoPorLote.get(loteId)?.get(claveSemana(s.anio, s.semana)) ?? 0
  }

  function netoDe(loteId: string, s: SemanaReal): number {
    return embolsadoDe(loteId, s) - repicadoDe(loteId, s)
  }

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    if (nombre !== OPCION_TODAS) guardarFincaActual(nombre)
  }

  const mostrarResumen = esAdmin && fincaSeleccionada === OPCION_TODAS
  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Repiques</h1>
      <p className="mb-6 text-sm text-gray-500">
        Inventario neto de racimos embolsados por semana, lote y finca, ya descontando lo repicado (viento, lluvia,
        problemas fisiológicos). El número grande es lo que queda; el pequeño, lo repicado de esa semana.
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
      </div>

      {loadingLotes || loadingEmbolses || loadingRepiques ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : mostrarResumen ? (
        <ResumenGeneral fincas={fincasOrdenadas} lotesPorFinca={lotesPorFinca} semanas={semanas} netoDe={netoDe} />
      ) : finca ? (
        <DetalleFinca
          finca={finca}
          lotes={lotesPorFinca.get(finca.nombre) ?? []}
          semanas={semanas}
          embolsadoDe={embolsadoDe}
          repicadoDe={repicadoDe}
          netoDe={netoDe}
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
  netoDe,
}: {
  fincas: Finca[]
  lotesPorFinca: Map<string, Lote[]>
  semanas: SemanaReal[]
  netoDe: (loteId: string, s: SemanaReal) => number
}) {
  function totalFinca(finca: string, s: SemanaReal) {
    return (lotesPorFinca.get(finca) ?? []).reduce((sum, l) => sum + netoDe(l.id, s), 0)
  }

  const grupos = useMemo(() => {
    const porEmpresa = new Map<string, Finca[]>()
    for (const f of fincas) {
      const empresa = f.empresa || SIN_EMPRESA
      if (!porEmpresa.has(empresa)) porEmpresa.set(empresa, [])
      porEmpresa.get(empresa)!.push(f)
    }
    return Array.from(porEmpresa.entries())
  }, [fincas])

  function totalEmpresa(fincasEmpresa: Finca[], s: SemanaReal) {
    return fincasEmpresa.reduce((sum, f) => sum + totalFinca(f.nombre, s), 0)
  }

  function totalGeneral(s: SemanaReal) {
    return fincas.reduce((sum, f) => sum + totalFinca(f.nombre, s), 0)
  }

  return (
    <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <th className="sticky top-0 left-0 z-[3] w-[160px] border border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">
              Finca
            </th>
            {semanas.map((s) => (
              <EncabezadoSemana key={claveSemana(s.anio, s.semana)} s={s} />
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(([empresa, fincasEmpresa]) => (
            <Fragment key={empresa}>
              {fincasEmpresa.map((f) => (
                <tr key={f.nombre} className="border-b border-gray-100">
                  <td className="sticky left-0 z-[1] border border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                    {f.nombre}
                  </td>
                  {semanas.map((s) => (
                    <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                      {totalFinca(f.nombre, s).toLocaleString('es')}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b-2 border-banex-100 bg-banex-50/40 font-semibold text-banex-800">
                <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/40 py-1.5 pr-3 pl-4">{empresa} - TOTAL</td>
                {semanas.map((s) => (
                  <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                    {totalEmpresa(fincasEmpresa, s).toLocaleString('es')}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
            <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/50 py-1.5 pr-3 pl-4">Total general</td>
            {semanas.map((s) => (
              <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                {totalGeneral(s).toLocaleString('es')}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DetalleFinca({
  finca,
  lotes,
  semanas,
  embolsadoDe,
  repicadoDe,
  netoDe,
}: {
  finca: Finca
  lotes: Lote[]
  semanas: SemanaReal[]
  embolsadoDe: (loteId: string, s: SemanaReal) => number
  repicadoDe: (loteId: string, s: SemanaReal) => number
  netoDe: (loteId: string, s: SemanaReal) => number
}) {
  function totalSemana(s: SemanaReal) {
    return lotes.reduce((sum, l) => sum + netoDe(l.id, s), 0)
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-banex-800">
        {finca.nombre}
        {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>}
      </h2>

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
                {semanas.map((s) => (
                  <EncabezadoSemana key={claveSemana(s.anio, s.semana)} s={s} />
                ))}
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="sticky left-0 z-[1] border border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                    {l.nombre}
                  </td>
                  {semanas.map((s) => {
                    const embolsado = embolsadoDe(l.id, s)
                    const repicado = repicadoDe(l.id, s)
                    return (
                      <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-1 py-1 text-center">
                        <div>{embolsado > 0 || repicado > 0 ? netoDe(l.id, s).toLocaleString('es') : '0'}</div>
                        {repicado > 0 && <div className="text-[10px] text-red-500">-{repicado.toLocaleString('es')}</div>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/50 py-1.5 pr-3 pl-4">TOTAL</td>
                {semanas.map((s) => (
                  <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                    {totalSemana(s).toLocaleString('es')}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

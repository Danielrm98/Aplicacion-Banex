import { Fragment, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { useCosechaEmbolse } from '../lib/useCosechaEmbolse'
import { semanasDelAnioEmbolses, anioEmbolsesDe, type SemanaReal } from '../lib/anioEmbolses'
import { colorCintaDe, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { posicionFinca } from '../lib/ordenFincas'
import type { Finca } from '../types/finca'

const SIN_EMPRESA = 'Sin empresa asignada'

function claveSemana(anio: number, semana: number) {
  return `${anio}_${semana}`
}

export default function RecobroPage() {
  const { perfil, loading: loadingPerfil } = usePerfil()

  if (loadingPerfil) {
    return <p className="py-16 text-center text-sm text-gray-500">Cargando...</p>
  }
  if (perfil?.rol !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <RecobroContenido />
}

function RecobroContenido() {
  const { fincas: todasLasFincas } = useFincas()
  const fincasOrdenadas = useMemo(
    () => [...todasLasFincas].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [todasLasFincas],
  )
  const { lotes, loading: loadingLotes } = useLotes()

  const [anioEmbolses, setAnioEmbolses] = useState(() =>
    anioEmbolsesDe(new Date().getFullYear(), getIsoWeek(fechaLocalHoy())),
  )
  const { embolses, loading: loadingEmbolses } = useEmbolses({ anioEmbolses })
  const { cosecha, loading: loadingCosecha } = useCosechaEmbolse({ anioEmbolses })

  const semanas = useMemo(() => semanasDelAnioEmbolses(anioEmbolses), [anioEmbolses])

  const fincaPorLote = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of lotes) m.set(l.id, l.finca)
    return m
  }, [lotes])

  // Embolses es por lote; se agrega a nivel de finca porque lo cosechado
  // (Registrar) solo se conoce por finca, no por lote.
  const embolsadoPorFinca = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const e of embolses) {
      const finca = fincaPorLote.get(e.lote_id)
      if (!finca) continue
      if (!m.has(finca)) m.set(finca, new Map())
      const porSemana = m.get(finca)!
      const clave = claveSemana(e.anio, e.semana)
      porSemana.set(clave, (porSemana.get(clave) ?? 0) + e.cantidad)
    }
    return m
  }, [embolses, fincaPorLote])

  const cosechadoPorFinca = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const c of cosecha) {
      if (!m.has(c.finca)) m.set(c.finca, new Map())
      m.get(c.finca)!.set(claveSemana(c.anio_embolse, c.semana_embolse), c.cantidad)
    }
    return m
  }, [cosecha])

  function embolsadoDe(finca: string, s: SemanaReal): number {
    return embolsadoPorFinca.get(finca)?.get(claveSemana(s.anio, s.semana)) ?? 0
  }

  function cosechadoDe(finca: string, s: SemanaReal): number {
    return cosechadoPorFinca.get(finca)?.get(claveSemana(s.anio, s.semana)) ?? 0
  }

  function recobroDe(embolsado: number, cosechado: number): number | null {
    if (embolsado <= 0) return null
    return (cosechado / embolsado) * 100
  }

  const grupos = useMemo(() => {
    const porEmpresa = new Map<string, Finca[]>()
    for (const f of fincasOrdenadas) {
      const empresa = f.empresa || SIN_EMPRESA
      if (!porEmpresa.has(empresa)) porEmpresa.set(empresa, [])
      porEmpresa.get(empresa)!.push(f)
    }
    return Array.from(porEmpresa.entries())
  }, [fincasOrdenadas])

  function totalEmpresa(fincasEmpresa: Finca[], s: SemanaReal) {
    const embolsado = fincasEmpresa.reduce((sum, f) => sum + embolsadoDe(f.nombre, s), 0)
    const cosechado = fincasEmpresa.reduce((sum, f) => sum + cosechadoDe(f.nombre, s), 0)
    return recobroDe(embolsado, cosechado)
  }

  function totalGeneral(s: SemanaReal) {
    const embolsado = fincasOrdenadas.reduce((sum, f) => sum + embolsadoDe(f.nombre, s), 0)
    const cosechado = fincasOrdenadas.reduce((sum, f) => sum + cosechadoDe(f.nombre, s), 0)
    return recobroDe(embolsado, cosechado)
  }

  function formatoPorcentaje(valor: number | null) {
    return valor === null ? '—' : `${valor.toFixed(0)}%`
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Recobro</h1>
      <p className="mb-6 text-sm text-gray-500">
        Porcentaje de recuperación de cada semana de embolse: cuánto de lo embolsado se llegó a cosechar (Cosechado ÷
        Embolsado), por finca. Como Registrar guarda la cosecha por finca (sin lote), este reporte es por finca, no
        por lote.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
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

      {loadingLotes || loadingEmbolses || loadingCosecha ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="sticky top-0 left-0 z-[3] w-[160px] border border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">
                  Finca
                </th>
                {semanas.map((s) => {
                  const color = colorCintaDe(s.anio, s.semana)
                  const estilo = ESTILO_CINTA[color]
                  return (
                    <th
                      key={claveSemana(s.anio, s.semana)}
                      className="sticky top-0 z-[2] w-[56px] border border-gray-200 px-1.5 py-1.5 text-center font-medium"
                      style={{ backgroundColor: estilo.bg, color: estilo.texto }}
                      title={`Semana ${s.semana}/${s.anio} · Cinta ${color.charAt(0)}${color.slice(1).toLowerCase()}`}
                    >
                      {s.semana}
                    </th>
                  )
                })}
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
                          {formatoPorcentaje(recobroDe(embolsadoDe(f.nombre, s), cosechadoDe(f.nombre, s)))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-b-2 border-banex-100 bg-banex-50/40 font-semibold text-banex-800">
                    <td className="sticky left-0 z-[1] border border-gray-200 bg-banex-50/40 py-1.5 pr-3 pl-4">{empresa} - TOTAL</td>
                    {semanas.map((s) => (
                      <td key={claveSemana(s.anio, s.semana)} className="border border-gray-200 px-2 py-1.5 text-center">
                        {formatoPorcentaje(totalEmpresa(fincasEmpresa, s))}
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
                    {formatoPorcentaje(totalGeneral(s))}
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

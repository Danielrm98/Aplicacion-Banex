import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useReferencias } from '../lib/useReferencias'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { posicionFinca } from '../lib/ordenFincas'
import type { PlanSemana } from '../types/plan'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function PlanGeneralPage() {
  const { perfil } = usePerfil()
  const { session } = useAuth()
  const { fincas: fincasSinOrdenar } = useFincas()
  const fincas = useMemo(
    () => [...fincasSinOrdenar].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasSinOrdenar],
  )
  const { referencias } = useReferencias()

  const [semana, setSemana] = useState(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [planes, setPlanes] = useState<PlanSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [columnas, setColumnas] = useState<string[]>([])
  const [celdas, setCeldas] = useState<Record<string, Record<string, string>>>({})
  const [nuevaReferencia, setNuevaReferencia] = useState('')

  const cargarPlanes = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('planes_semana')
      .select('*, items:plan_items(*)')
      .eq('anio', anio)
      .eq('semana', semana)

    if (error) {
      setError(error.message)
      setPlanes([])
    } else {
      setPlanes(data ?? [])
    }
    setLoading(false)
  }, [anio, semana])

  useEffect(() => {
    cargarPlanes()
  }, [cargarPlanes])

  useEffect(() => {
    const cols = new Set<string>()
    const grid: Record<string, Record<string, string>> = {}
    for (const p of planes) {
      grid[p.finca] = {}
      for (const it of p.items) {
        cols.add(it.referencia)
        grid[p.finca][it.referencia] = String(it.pallets_plan)
      }
    }
    setColumnas(Array.from(cols).sort())
    setCeldas(grid)
  }, [planes])

  function catalogoDe(marca: string) {
    return referencias.find((r) => r.marca === marca) ?? null
  }

  function setCelda(finca: string, referencia: string, valor: string) {
    setCeldas((prev) => ({ ...prev, [finca]: { ...prev[finca], [referencia]: valor } }))
  }

  function totalFilaPallets(finca: string) {
    return columnas.reduce((sum, ref) => sum + (Number(celdas[finca]?.[ref]) || 0), 0)
  }

  function totalColumnaPallets(referencia: string) {
    return fincas.reduce((sum, f) => sum + (Number(celdas[f.nombre]?.[referencia]) || 0), 0)
  }

  const totalGeneral = columnas.reduce((sum, ref) => sum + totalColumnaPallets(ref), 0)

  function agregarColumna(e: FormEvent) {
    e.preventDefault()
    const marca = nuevaReferencia.trim().toUpperCase()
    if (!marca) return
    if (!referencias.some((r) => r.marca === marca)) {
      setError(`"${marca}" no es una referencia del catálogo.`)
      return
    }
    setError(null)
    if (!columnas.includes(marca)) setColumnas((prev) => [...prev, marca].sort())
    setNuevaReferencia('')
  }

  async function quitarColumna(referencia: string) {
    if (!confirm(`¿Quitar "${referencia}" del plan general de todas las fincas en esta semana?`)) return
    const planIds = planes.map((p) => p.id)
    if (planIds.length > 0) {
      const { error } = await supabase.from('plan_items').delete().eq('referencia', referencia).in('plan_id', planIds)
      if (error) {
        alert(`No se pudo quitar: ${error.message}`)
        return
      }
    }
    setColumnas((prev) => prev.filter((c) => c !== referencia))
    await cargarPlanes()
  }

  async function guardarTodo() {
    if (!session?.user.id) return
    setGuardando(true)
    setError(null)
    try {
      const userId = session.user.id
      const planIdDe = new Map(planes.map((p) => [p.finca, p.id]))

      const inserts = fincas
        .filter((f) => !planIdDe.has(f.nombre))
        .filter((f) => columnas.some((ref) => (celdas[f.nombre]?.[ref] ?? '').trim() !== ''))
        .map((f) => ({ finca: f.nombre, semana, anio, user_id: userId }))

      if (inserts.length > 0) {
        const { data, error: insertError } = await supabase.from('planes_semana').insert(inserts).select('id, finca')
        if (insertError) throw insertError
        for (const nuevo of data ?? []) planIdDe.set(nuevo.finca, nuevo.id)
      }

      const itemsUpsert: { plan_id: string; referencia: string; pallets_plan: number; cajas_plan: number }[] = []
      for (const f of fincas) {
        const planId = planIdDe.get(f.nombre)
        if (!planId) continue
        for (const ref of columnas) {
          const raw = celdas[f.nombre]?.[ref]
          if (raw === undefined || raw.trim() === '') continue
          const pallets = Number(raw)
          if (Number.isNaN(pallets) || pallets < 0) continue
          const cat = catalogoDe(ref)
          itemsUpsert.push({
            plan_id: planId,
            referencia: ref,
            pallets_plan: pallets,
            cajas_plan: cat ? Math.round(pallets * cat.cajas_pallet) : 0,
          })
        }
      }

      if (itemsUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('plan_items')
          .upsert(itemsUpsert, { onConflict: 'plan_id,referencia' })
        if (upsertError) throw upsertError
      }

      await cargarPlanes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuadrícula.')
    } finally {
      setGuardando(false)
    }
  }

  if (perfil?.rol === 'operador') {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Plan general</h1>
      <p className="mb-6 text-sm text-gray-500">
        Ingresa de una vez los pallets meta de cada finca por referencia para una semana. Al guardar, se refleja
        automáticamente en el plan individual de cada finca (cajas meta se calcula sola).
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
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

        <button
          onClick={guardarTodo}
          disabled={guardando || loading}
          className="ml-auto rounded-lg bg-banex-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar cuadrícula'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mb-4 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="sticky left-0 z-10 bg-gray-50 py-2 pr-3 pl-4 font-medium">Finca</th>
                  {columnas.map((ref) => {
                    const cat = catalogoDe(ref)
                    return (
                      <th key={ref} className="min-w-[110px] px-2 py-2 text-center font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <span>{ref}</span>
                          <button
                            type="button"
                            onClick={() => quitarColumna(ref)}
                            title="Quitar esta referencia del plan general"
                            className="text-gray-300 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                        {cat && <div className="text-[10px] font-normal text-gray-400">{cat.cajas_pallet} cajas/pallet</div>}
                      </th>
                    )
                  })}
                  <th className="min-w-[100px] px-3 py-2 text-center font-medium">Total pallets</th>
                </tr>
              </thead>
              <tbody>
                {columnas.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-sm text-gray-500">
                      Aún no hay referencias en el plan general de esta semana. Agrega una abajo.
                    </td>
                  </tr>
                ) : (
                  fincas.map((f) => (
                    <tr key={f.nombre} className="border-b border-gray-100">
                      <td className="sticky left-0 z-10 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                        {f.nombre}
                      </td>
                      {columnas.map((ref) => {
                        const cat = catalogoDe(ref)
                        const valor = celdas[f.nombre]?.[ref] ?? ''
                        const pallets = Number(valor) || 0
                        const cajas = cat && valor.trim() !== '' ? Math.round(pallets * cat.cajas_pallet) : null
                        return (
                          <td key={ref} className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={valor}
                              onChange={(e) => setCelda(f.nombre, ref, e.target.value)}
                              className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/15"
                            />
                            {cajas !== null && <div className="mt-0.5 text-[10px] text-gray-400">{cajas} cajas</div>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-1.5 text-center font-medium text-banex-700">
                        {totalFilaPallets(f.nombre).toLocaleString('es', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {columnas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                    <td className="sticky left-0 z-10 bg-banex-50/50 py-1.5 pr-3 pl-4">Total</td>
                    {columnas.map((ref) => (
                      <td key={ref} className="px-2 py-1.5 text-center">
                        {totalColumnaPallets(ref).toLocaleString('es', { maximumFractionDigits: 2 })}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center">
                      {totalGeneral.toLocaleString('es', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <form onSubmit={agregarColumna} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Agregar referencia a la cuadrícula</span>
                <input
                  type="text"
                  list="referencias-catalogo-general"
                  autoComplete="off"
                  value={nuevaReferencia}
                  onChange={(e) => setNuevaReferencia(e.target.value)}
                  placeholder="Escribe o elige una referencia"
                  className="w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md"
              >
                Agregar
              </button>
            </div>
            <datalist id="referencias-catalogo-general">
              {referencias.map((r) => (
                <option key={r.marca} value={r.marca} />
              ))}
            </datalist>
          </form>
        </>
      )}
    </div>
  )
}

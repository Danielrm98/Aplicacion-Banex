import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getIsoWeek } from '../lib/isoWeek'
import { useReferencias } from '../lib/useReferencias'
import { useFincas } from '../lib/useFincas'
import { useProducciones } from '../lib/useProducciones'
import { usePlan } from '../lib/usePlan'
import { flattenItems } from '../lib/aggregations'
import { obtenerFincaActual } from '../lib/fincaActual'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { usePerfil } from '../lib/usePerfil'
import { useDraftState } from '../lib/useDraftState'
import type { PlanItem } from '../types/plan'
import SectionHeading from '../components/SectionHeading'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function PlanPage() {
  const { fincas } = useFincas()
  const { perfil } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const [finca, setFinca] = useState<string>(() => obtenerFincaActual() ?? '')
  const [semana, setSemana] = useState<number>(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    if (esOperador) {
      if (perfil?.finca && finca !== perfil.finca) setFinca(perfil.finca)
      return
    }
    if (fincas.length === 0) return
    if (finca && fincas.some((f) => f.nombre === finca)) return
    const guardada = obtenerFincaActual()
    setFinca(guardada && fincas.some((f) => f.nombre === guardada) ? guardada : fincas[0].nombre)
  }, [fincas, finca, esOperador, perfil?.finca])

  const { referencias } = useReferencias()
  const { registros } = useProducciones({ semana, finca })
  const { plan, loading, error, refetch } = usePlan({ finca, semana, anio })

  const producidoMap = useMemo(() => {
    const delAnio = registros.filter((r) => r.fecha.slice(0, 4) === String(anio))
    const filas = flattenItems(delAnio)
    const map = new Map<string, number>()
    for (const f of filas) {
      map.set(f.referencia, (map.get(f.referencia) ?? 0) + f.cantidad_cajas)
    }
    return map
  }, [registros, anio])

  function catalogoDe(marca: string) {
    return referencias.find((r) => r.marca === marca) ?? null
  }

  async function crearPlan() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase
      .from('planes_semana')
      .insert({ finca, semana, anio, user_id: user.id })

    if (insertError) {
      alert(`No se pudo crear el plan: ${insertError.message}`)
      return
    }
    refetch()
  }

  async function eliminarPlan() {
    if (!plan) return
    if (!confirm(`¿Eliminar el plan completo de ${finca} - semana ${semana}/${anio}?`)) return
    const { error: deleteError } = await supabase.from('planes_semana').delete().eq('id', plan.id)
    if (deleteError) {
      alert(`No se pudo eliminar: ${deleteError.message}`)
      return
    }
    refetch()
  }

  const planReferencias = new Set(plan?.items.map((it) => it.referencia) ?? [])
  const adicionales = Array.from(producidoMap.entries()).filter(([ref]) => !planReferencias.has(ref))
  const totalPalletsPlan = plan?.items.reduce((sum, it) => sum + it.pallets_plan, 0) ?? 0
  const totalCajasPlan = plan?.items.reduce((sum, it) => sum + it.cajas_plan, 0) ?? 0

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Plan semanal</h1>
      <p className="mb-6 text-sm text-gray-500">
        Meta de pallets por referencia para una finca en una semana (las cajas se calculan solas), y su
        cumplimiento frente a la producción real.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={finca}
            disabled={esOperador}
            onChange={(e) => setFinca(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {esOperador ? (
              <option value={finca}>{finca}</option>
            ) : (
              fincas.map((f) => (
                <option key={f.nombre} value={f.nombre}>
                  {f.nombre}
                </option>
              ))
            )}
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
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : !plan ? (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 text-center">
          <p className="mb-3 text-sm text-gray-600">
            Aún no hay plan para <strong>{finca}</strong>, semana {semana}/{anio}.
          </p>
          <button
            onClick={crearPlan}
            className="rounded-lg bg-banex-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md"
          >
            Crear plan
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-banex-800">
              {finca} · Semana {semana}/{anio}
            </h2>
            <button
              onClick={eliminarPlan}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar plan
            </button>
          </div>

          <div className="mb-4 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm p-4">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="sticky left-0 z-10 border-r border-gray-200 bg-white py-1.5 pr-3 pl-1 font-medium sm:static sm:border-r-0 sm:bg-transparent sm:pl-0">
                    Referencia
                  </th>
                  <th className="py-1.5 pr-3 font-medium">Pallets plan</th>
                  <th className="py-1.5 pr-3 font-medium">Cajas plan</th>
                  <th className="py-1.5 pr-3 font-medium">Cajas producidas</th>
                  <th className="py-1.5 pr-3 font-medium">Pallets producidos</th>
                  <th className="py-1.5 pr-3 font-medium">Faltante/Sobrante cajas</th>
                  <th className="py-1.5 pr-3 font-medium">Faltante/Sobrante pallets</th>
                  <th className="py-1.5 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    cajasPallet={catalogoDe(item.referencia)?.cajas_pallet ?? null}
                    cajasProducidas={producidoMap.get(item.referencia) ?? 0}
                    onChanged={refetch}
                  />
                ))}
                {plan.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-gray-500">
                      Este plan todavía no tiene referencias. Agrega una abajo.
                    </td>
                  </tr>
                )}
              </tbody>
              {plan.items.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                    <td className="sticky left-0 z-10 border-r border-gray-200 bg-banex-50 py-1.5 pr-3 pl-1 sm:static sm:border-r-0 sm:bg-transparent sm:pl-0">
                      Total
                    </td>
                    <td className="py-1.5 pr-3">{totalPalletsPlan.toLocaleString('es', { maximumFractionDigits: 2 })}</td>
                    <td className="py-1.5 pr-3">{totalCajasPlan.toLocaleString('es')}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <AddPlanItemForm planId={plan.id} existentes={planReferencias} onAdded={refetch} />

          {adicionales.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-amber-900">Producido sin plan asignado</h3>
              <div className="flex flex-col gap-2">
                {adicionales.map(([referencia, cajas]) => (
                  <AdicionalRow
                    key={referencia}
                    planId={plan.id}
                    referencia={referencia}
                    cajas={cajas}
                    onAdded={refetch}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlanItemRow({
  item,
  cajasPallet,
  cajasProducidas,
  onChanged,
}: {
  item: PlanItem
  cajasPallet: number | null
  cajasProducidas: number
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftPallets, setDraftPallets] = useState(item.pallets_plan)
  const [busy, setBusy] = useState(false)

  const palletsProducidos = cajasPallet ? cajasProducidas / cajasPallet : null
  const faltanteCajas = item.cajas_plan - cajasProducidas
  const faltantePallets = cajasPallet ? item.pallets_plan - cajasProducidas / cajasPallet : null

  async function save() {
    setBusy(true)
    const cajasCalculadas = cajasPallet ? Math.round(draftPallets * cajasPallet) : 0
    const { error } = await supabase
      .from('plan_items')
      .update({ pallets_plan: draftPallets, cajas_plan: cajasCalculadas })
      .eq('id', item.id)
    setBusy(false)
    if (error) {
      alert(`No se pudo guardar: ${error.message}`)
      return
    }
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!confirm(`¿Quitar "${item.referencia}" del plan?`)) return
    setBusy(true)
    const { error } = await supabase.from('plan_items').delete().eq('id', item.id)
    setBusy(false)
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    onChanged()
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="sticky left-0 z-10 border-r border-gray-200 bg-white py-1.5 pr-3 pl-1 font-medium text-gray-900 sm:static sm:border-r-0 sm:bg-transparent sm:pl-0">
        {item.referencia}
      </td>
      <td className="py-1.5 pr-3">
        {editing ? (
          <input
            type="number"
            min={0}
            step="0.1"
            value={draftPallets}
            onChange={(e) => setDraftPallets(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/15"
          />
        ) : (
          item.pallets_plan
        )}
      </td>
      <td className="py-1.5 pr-3 text-gray-500">
        {editing
          ? cajasPallet
            ? Math.round(draftPallets * cajasPallet)
            : '—'
          : item.cajas_plan}
      </td>
      <td className="py-1.5 pr-3">{cajasProducidas}</td>
      <td className="py-1.5 pr-3 text-gray-500">{palletsProducidos !== null ? palletsProducidos.toFixed(2) : '—'}</td>
      <td className={`py-1.5 pr-3 font-medium ${faltanteCajas > 0 ? 'text-red-600' : 'text-banex-700'}`}>
        {faltanteCajas > 0 ? `Faltan ${faltanteCajas}` : `Cumplido (+${-faltanteCajas})`}
      </td>
      <td className={`py-1.5 pr-3 font-medium ${faltantePallets !== null && faltantePallets > 0 ? 'text-red-600' : 'text-banex-700'}`}>
        {faltantePallets === null ? '—' : faltantePallets > 0 ? `Faltan ${faltantePallets.toFixed(2)}` : `Cumplido (+${(-faltantePallets).toFixed(2)})`}
      </td>
      <td className="flex gap-2 py-1.5 pr-3 whitespace-nowrap">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-md bg-banex-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setDraftPallets(item.pallets_plan)
                setEditing(true)
              }}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
            >
              Editar
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Eliminar
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

function AddPlanItemForm({
  planId,
  existentes,
  onAdded,
}: {
  planId: string
  existentes: Set<string>
  onAdded: () => void
}) {
  const { referencias } = useReferencias()
  const [draft, setDraft, limpiarDraft] = useDraftState(`approban_borrador_plan_item_${planId}`, {
    referencia: '',
    palletsPlan: 0,
  })
  const { referencia, palletsPlan } = draft
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const catalogo = referencias.find((r) => r.marca === referencia.trim().toUpperCase())
  const cajasCalculadas = catalogo ? Math.round(palletsPlan * catalogo.cajas_pallet) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const marca = referencia.trim().toUpperCase()
    const ref = referencias.find((r) => r.marca === marca)
    if (!ref) {
      setError(`"${referencia}" no es una referencia del catálogo.`)
      return
    }
    if (existentes.has(marca)) {
      setError(`"${marca}" ya está en el plan.`)
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('plan_items').insert({
      plan_id: planId,
      referencia: marca,
      pallets_plan: palletsPlan,
      cajas_plan: Math.round(palletsPlan * ref.cajas_pallet),
    })
    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }
    limpiarDraft()
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <SectionHeading>Agregar referencia al plan</SectionHeading>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Referencia">
          <input
            type="text"
            required
            list="referencias-catalogo-plan"
            autoComplete="off"
            value={referencia}
            onChange={(e) => setDraft((prev) => ({ ...prev, referencia: e.target.value }))}
            className="w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            placeholder="Escribe o elige una referencia"
          />
        </Field>
        <Field label="Pallets meta">
          <input
            type="number"
            required
            min={0}
            step="0.1"
            value={palletsPlan || ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, palletsPlan: Number(e.target.value) }))}
            className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </Field>
        <Field label="Cajas meta (calculado)">
          <input
            type="text"
            disabled
            value={cajasCalculadas ?? '—'}
            className="w-28 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <datalist id="referencias-catalogo-plan">
        {referencias.map((r) => (
          <option key={r.marca} value={r.marca} />
        ))}
      </datalist>
    </form>
  )
}

function AdicionalRow({
  planId,
  referencia,
  cajas,
  onAdded,
}: {
  planId: string
  referencia: string
  cajas: number
  onAdded: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function agregar() {
    setBusy(true)
    const { error } = await supabase
      .from('plan_items')
      .insert({ plan_id: planId, referencia, pallets_plan: 0, cajas_plan: 0 })
    setBusy(false)
    if (error) {
      alert(`No se pudo agregar: ${error.message}`)
      return
    }
    onAdded()
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
      <span>
        <strong className="text-gray-900">{referencia}</strong>
        <span className="text-gray-500"> — {cajas} cajas producidas, no estaba en el plan</span>
      </span>
      <button
        onClick={agregar}
        disabled={busy}
        className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
      >
        + Agregar al plan
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

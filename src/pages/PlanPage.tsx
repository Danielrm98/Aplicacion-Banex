import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FINCAS } from '../lib/fincas'
import { getIsoWeek } from '../lib/isoWeek'
import { useReferencias } from '../lib/useReferencias'
import { useProducciones } from '../lib/useProducciones'
import { usePlan } from '../lib/usePlan'
import { flattenItems } from '../lib/aggregations'
import type { PlanItem } from '../types/plan'

const hoy = new Date().toISOString().slice(0, 10)
const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

export default function PlanPage() {
  const [finca, setFinca] = useState<string>(FINCAS[0])
  const [semana, setSemana] = useState<number>(getIsoWeek(hoy))
  const [anio, setAnio] = useState<number>(new Date().getFullYear())

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

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Plan semanal</h1>
      <p className="mb-6 text-sm text-gray-500">
        Meta de pallets por referencia para una finca en una semana (las cajas se calculan solas), y su
        cumplimiento frente a la producción real.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={finca}
            onChange={(e) => setFinca(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {FINCAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Semana</span>
          <select
            value={semana}
            onChange={(e) => setSemana(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
            className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : !plan ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="mb-3 text-sm text-gray-600">
            Aún no hay plan para <strong>{finca}</strong>, semana {semana}/{anio}.
          </p>
          <button
            onClick={crearPlan}
            className="rounded-md bg-banex-600 px-5 py-2 text-sm font-medium text-white hover:bg-banex-700"
          >
            Crear plan
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              {finca} · Semana {semana}/{anio}
            </h2>
            <button
              onClick={eliminarPlan}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Eliminar plan
            </button>
          </div>

          <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 bg-white p-4">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-1.5 pr-3 font-medium">Referencia</th>
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
            </table>
          </div>

          <AddPlanItemForm planId={plan.id} existentes={planReferencias} onAdded={refetch} />

          {adicionales.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-medium text-amber-900">Producido sin plan asignado</h3>
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
      <td className="py-1.5 pr-3 font-medium text-gray-900">{item.referencia}</td>
      <td className="py-1.5 pr-3">
        {editing ? (
          <input
            type="number"
            min={0}
            step="0.1"
            value={draftPallets}
            onChange={(e) => setDraftPallets(Number(e.target.value))}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
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
              className="rounded bg-banex-600 px-2 py-1 text-xs font-medium text-white hover:bg-banex-700 disabled:opacity-50"
            >
              Guardar
            </button>
            <button onClick={() => setEditing(false)} className="rounded border border-gray-300 px-2 py-1 text-xs">
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
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
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
  const [referencia, setReferencia] = useState('')
  const [palletsPlan, setPalletsPlan] = useState(0)
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
    setReferencia('')
    setPalletsPlan(0)
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Agregar referencia al plan</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Referencia">
          <input
            type="text"
            required
            list="referencias-catalogo-plan"
            autoComplete="off"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-banex-600 focus:outline-none"
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
            onChange={(e) => setPalletsPlan(Number(e.target.value))}
            className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-banex-600 focus:outline-none"
          />
        </Field>
        <Field label="Cajas meta (calculado)">
          <input
            type="text"
            disabled
            value={cajasCalculadas ?? '—'}
            className="w-28 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-banex-600 px-4 py-2 text-sm font-medium text-white hover:bg-banex-700 disabled:opacity-50"
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
    <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
      <span>
        <strong className="text-gray-900">{referencia}</strong>
        <span className="text-gray-500"> — {cajas} cajas producidas, no estaba en el plan</span>
      </span>
      <button
        onClick={agregar}
        disabled={busy}
        className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
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

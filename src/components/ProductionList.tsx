import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FINCAS } from '../lib/fincas'
import {
  CAJA_20KG_KG,
  CANASTILLA_KG,
  SEMANAS_RACIMO,
  TIPOS_TRANSPORTE,
  type Produccion,
  type ProduccionItem,
  type Referencia,
  type Transporte,
} from '../types/produccion'
import type { Finca } from '../types/finca'
import { resumenDesdeProduccion } from '../lib/shareSummary'
import ShareSummaryPanel from './ShareSummaryPanel'

function campoRacimo(semana: (typeof SEMANAS_RACIMO)[number]) {
  return `racimos_semana_${semana}` as const
}

function campoGrado(semana: (typeof SEMANAS_RACIMO)[number]) {
  return `grado_semana_${semana}` as const
}

interface HeaderDraft {
  fecha: string
  hora_finalizacion: string
  semana: number
  finca: string
  area_recorrida: number | null
  racimos_semana_7: number
  racimos_semana_8: number
  racimos_semana_9: number
  racimos_semana_10: number
  racimos_semana_11: number
  racimos_semana_12: number
  grado_semana_7: number | null
  grado_semana_8: number | null
  grado_semana_9: number | null
  grado_semana_10: number | null
  grado_semana_11: number | null
  grado_semana_12: number | null
  racimos_recusados: number
  canastillas: number
  notas: string
}

function headerDraftDe(registro: Produccion): HeaderDraft {
  return {
    fecha: registro.fecha,
    hora_finalizacion: registro.hora_finalizacion ?? '',
    semana: registro.semana,
    finca: registro.finca,
    area_recorrida: registro.area_recorrida,
    racimos_semana_7: registro.racimos_semana_7,
    racimos_semana_8: registro.racimos_semana_8,
    racimos_semana_9: registro.racimos_semana_9,
    racimos_semana_10: registro.racimos_semana_10,
    racimos_semana_11: registro.racimos_semana_11,
    racimos_semana_12: registro.racimos_semana_12,
    grado_semana_7: registro.grado_semana_7,
    grado_semana_8: registro.grado_semana_8,
    grado_semana_9: registro.grado_semana_9,
    grado_semana_10: registro.grado_semana_10,
    grado_semana_11: registro.grado_semana_11,
    grado_semana_12: registro.grado_semana_12,
    racimos_recusados: registro.racimos_recusados,
    canastillas: registro.canastillas,
    notas: registro.notas ?? '',
  }
}

interface Props {
  registros: Produccion[]
  referencias: Referencia[]
  fincas: Finca[]
  onChanged: () => void
  showDatalist?: boolean
}

export default function ProductionList({ registros, referencias, fincas, onChanged, showDatalist = true }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {registros.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay registros para los filtros seleccionados.</p>
      ) : (
        registros.map((registro) => (
          <RegistroCard
            key={registro.id}
            registro={registro}
            referencias={referencias}
            fincas={fincas}
            onChanged={onChanged}
          />
        ))
      )}

      {showDatalist && (
        <datalist id="referencias-catalogo">
          {referencias.map((r) => (
            <option key={r.marca} value={r.marca} />
          ))}
        </datalist>
      )}
    </div>
  )
}

function RegistroCard({
  registro,
  referencias,
  fincas,
  onChanged,
}: {
  registro: Produccion
  referencias: Referencia[]
  fincas: Finca[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerDraft, setHeaderDraft] = useState<HeaderDraft>(() => headerDraftDe(registro))
  const [headerError, setHeaderError] = useState<string | null>(null)
  const racimosSource = editingHeader ? headerDraft : registro
  const areaTotal = fincas.find((f) => f.nombre === racimosSource.finca)?.hectareas ?? null
  const areaRecorrida = racimosSource.area_recorrida
  const porcentajeDia = areaTotal && areaRecorrida !== null ? (areaRecorrida / areaTotal) * 100 : null
  const totalCajas = registro.items.reduce((sum, it) => sum + it.cantidad_cajas, 0)
  const totalCajas20kg = registro.items.reduce((sum, it) => sum + it.cajas_20kg, 0)
  const totalRechazadas = registro.items.reduce((sum, it) => sum + it.cajas_rechazadas, 0)
  const totalRacimos = SEMANAS_RACIMO.reduce((sum, semana) => sum + racimosSource[campoRacimo(semana)], 0)
  const totalRacimosProcesados = totalRacimos - racimosSource.racimos_recusados
  const kilosCajas20kg = totalCajas20kg * CAJA_20KG_KG
  const kilosCanastillas = racimosSource.canastillas * CANASTILLA_KG
  const pesoNetoRacimo = totalRacimos > 0 ? (kilosCajas20kg + kilosCanastillas) / totalRacimos : null
  const ratio = totalRacimos > 0 ? totalCajas20kg / totalRacimos : null
  const pesoTotalRacimos = pesoNetoRacimo !== null ? totalRacimos * pesoNetoRacimo : null
  const merma = pesoTotalRacimos !== null && pesoTotalRacimos > 0 ? (kilosCanastillas / pesoTotalRacimos) * 100 : null

  async function removeRegistro() {
    if (!confirm('¿Eliminar todo el registro del día (todas sus referencias)? No se puede deshacer.')) return
    setBusy(true)
    const { error } = await supabase.from('producciones').delete().eq('id', registro.id)
    setBusy(false)
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    onChanged()
  }

  function startEditHeader() {
    setHeaderDraft(headerDraftDe(registro))
    setHeaderError(null)
    setEditingHeader(true)
    setExpanded(true)
  }

  async function saveHeader() {
    setHeaderError(null)

    if (!headerDraft.finca) {
      setHeaderError('Selecciona una finca.')
      return
    }

    setBusy(true)
    const { error } = await supabase
      .from('producciones')
      .update({
        fecha: headerDraft.fecha,
        hora_finalizacion: headerDraft.hora_finalizacion || null,
        semana: headerDraft.semana,
        finca: headerDraft.finca,
        area_recorrida: headerDraft.area_recorrida,
        racimos_semana_7: headerDraft.racimos_semana_7,
        racimos_semana_8: headerDraft.racimos_semana_8,
        racimos_semana_9: headerDraft.racimos_semana_9,
        racimos_semana_10: headerDraft.racimos_semana_10,
        racimos_semana_11: headerDraft.racimos_semana_11,
        racimos_semana_12: headerDraft.racimos_semana_12,
        grado_semana_7: headerDraft.grado_semana_7,
        grado_semana_8: headerDraft.grado_semana_8,
        grado_semana_9: headerDraft.grado_semana_9,
        grado_semana_10: headerDraft.grado_semana_10,
        grado_semana_11: headerDraft.grado_semana_11,
        grado_semana_12: headerDraft.grado_semana_12,
        racimos_recusados: headerDraft.racimos_recusados,
        canastillas: headerDraft.canastillas,
        notas: headerDraft.notas || null,
      })
      .eq('id', registro.id)

    setBusy(false)
    if (error) {
      setHeaderError(error.message)
      return
    }
    setEditingHeader(false)
    onChanged()
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-gray-900">{registro.fecha}</span>
          <span className="text-gray-500">Semana {registro.semana}</span>
          <span className="text-gray-500">{registro.finca}</span>
          <span className="text-gray-500">{totalCajas.toLocaleString('es')} cajas</span>
          <span className="text-gray-500">{totalCajas20kg.toLocaleString('es', { maximumFractionDigits: 2 })} cajas 20kg</span>
          {totalRechazadas > 0 && <span className="text-red-600">{totalRechazadas} rechazadas</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md border border-banex-600 px-2 py-1 text-xs font-medium text-banex-700 shadow-sm transition-colors hover:bg-banex-50"
          >
            {expanded ? 'Colapsar ▲' : 'Expandir ▼'}
          </button>
          <button
            onClick={() => setSharing((s) => !s)}
            className="rounded-md border border-[#25D366] px-2 py-1 text-xs font-medium text-[#128C7E] shadow-sm transition-colors hover:bg-[#25D366]/10"
          >
            {sharing ? 'Ocultar compartir' : 'Compartir'}
          </button>
          {!editingHeader && (
            <button
              onClick={startEditHeader}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
            >
              Editar información
            </button>
          )}
          <button
            onClick={removeRegistro}
            disabled={busy}
            className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar registro
          </button>
        </div>
      </div>

      {sharing && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <ShareSummaryPanel
            resumen={resumenDesdeProduccion(registro, { areaTotal })}
            onClose={() => setSharing(false)}
          />
        </div>
      )}

      {expanded && (
        <div className="mt-4 flex flex-col gap-5 border-t border-gray-100 pt-4">
          {editingHeader ? (
            <>
              <Seccion titulo="Detalles generales">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MiniField label="Fecha">
                    <input
                      type="date"
                      value={headerDraft.fecha}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, fecha: e.target.value }))}
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="Hora de finalización">
                    <input
                      type="time"
                      value={headerDraft.hora_finalizacion}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, hora_finalizacion: e.target.value }))}
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="Semana">
                    <input
                      type="number"
                      min={1}
                      max={53}
                      value={headerDraft.semana}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, semana: Number(e.target.value) }))}
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="Finca">
                    <select
                      value={headerDraft.finca}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, finca: e.target.value }))}
                      className={smallInput}
                    >
                      {FINCAS.map((finca) => (
                        <option key={finca} value={finca}>
                          {finca}
                        </option>
                      ))}
                    </select>
                  </MiniField>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <MiniField label="Notas">
                      <input
                        type="text"
                        value={headerDraft.notas}
                        onChange={(e) => setHeaderDraft((d) => ({ ...d, notas: e.target.value }))}
                        className={smallInput}
                      />
                    </MiniField>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniField label="Área total (calc.)">
                    <input
                      type="text"
                      disabled
                      value={areaTotal !== null ? areaTotal.toLocaleString('es') : '—'}
                      className={`${smallInput} bg-gray-50`}
                    />
                  </MiniField>
                  <MiniField label="Área recorrida (ha)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={headerDraft.area_recorrida ?? ''}
                      onChange={(e) =>
                        setHeaderDraft((d) => ({
                          ...d,
                          area_recorrida: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="% del día (calc.)">
                    <input
                      type="text"
                      disabled
                      value={porcentajeDia !== null ? `${porcentajeDia.toFixed(1)}%` : '—'}
                      className={`${smallInput} bg-gray-50`}
                    />
                  </MiniField>
                </div>
              </Seccion>

              <Seccion titulo="Racimos">
                <div className="mb-3 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                  {SEMANAS_RACIMO.map((semana) => (
                    <div key={semana} className="rounded-lg border border-gray-200 bg-gray-50/60 p-2 transition-colors hover:border-banex-200">
                      <p className="mb-1 text-xs font-semibold text-gray-500">Semana {semana}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="block">
                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Racimos</span>
                          <input
                            type="number"
                            min={0}
                            value={headerDraft[campoRacimo(semana)] || ''}
                            onChange={(e) =>
                              setHeaderDraft((d) => ({ ...d, [campoRacimo(semana)]: Number(e.target.value) }))
                            }
                            className={cellInput}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-0.5 block text-[10px] font-medium text-gray-500">Grado</span>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={headerDraft[campoGrado(semana)] ?? ''}
                            onChange={(e) =>
                              setHeaderDraft((d) => ({
                                ...d,
                                [campoGrado(semana)]: e.target.value === '' ? null : Number(e.target.value),
                              }))
                            }
                            className={cellInput}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniField label="Racimos recusados">
                    <input
                      type="number"
                      min={0}
                      value={headerDraft.racimos_recusados || ''}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, racimos_recusados: Number(e.target.value) }))}
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="Cosechados (calc.)">
                    <input type="text" disabled value={totalRacimos} className={`${smallInput} bg-gray-50`} />
                  </MiniField>
                  <MiniField label="Procesados (calc.)">
                    <input
                      type="text"
                      disabled
                      value={totalRacimosProcesados}
                      className={`${smallInput} bg-gray-50`}
                    />
                  </MiniField>
                  <MiniField label="Peso neto racimo (calc.)">
                    <input
                      type="text"
                      disabled
                      value={pesoNetoRacimo !== null ? pesoNetoRacimo.toFixed(2) : '—'}
                      className={`${smallInput} bg-gray-50`}
                    />
                  </MiniField>
                </div>
              </Seccion>

              <Seccion titulo="Canastillas">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniField label="Cantidad">
                    <input
                      type="number"
                      min={0}
                      value={headerDraft.canastillas || ''}
                      onChange={(e) => setHeaderDraft((d) => ({ ...d, canastillas: Number(e.target.value) }))}
                      className={smallInput}
                    />
                  </MiniField>
                  <MiniField label="Kilos (calc.)">
                    <input
                      type="text"
                      disabled
                      value={kilosCanastillas.toFixed(2)}
                      className={`${smallInput} bg-gray-50`}
                    />
                  </MiniField>
                </div>
              </Seccion>

              {headerError && <p className="text-sm text-red-600">{headerError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={saveHeader}
                  disabled={busy}
                  className="rounded-lg bg-banex-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
                >
                  Guardar información
                </button>
                <button
                  onClick={() => {
                    setEditingHeader(false)
                    setHeaderError(null)
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <Seccion titulo="Detalles generales">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <span>
                    <span className="text-gray-400">Hora de finalización: </span>
                    {registro.hora_finalizacion ?? '—'}
                  </span>
                  <span>
                    <span className="text-gray-400">Área recorrida: </span>
                    {registro.area_recorrida !== null ? `${registro.area_recorrida.toLocaleString('es')} ha` : '—'}
                    {porcentajeDia !== null ? ` (${porcentajeDia.toFixed(1)}% de ${areaTotal?.toLocaleString('es')} ha)` : ''}
                  </span>
                  <span>
                    <span className="text-gray-400">Notas: </span>
                    {registro.notas ?? '—'}
                  </span>
                </div>
              </Seccion>

              <Seccion titulo="Racimos">
                <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <span>
                    <span className="text-gray-400">Cosechados: </span>
                    {totalRacimos.toLocaleString('es')}
                  </span>
                  <span className={registro.racimos_recusados > 0 ? 'text-red-600' : ''}>
                    <span className="text-gray-400">Recusados: </span>
                    {registro.racimos_recusados.toLocaleString('es')}
                  </span>
                  <span>
                    <span className="text-gray-400">Procesados: </span>
                    {totalRacimosProcesados.toLocaleString('es')}
                  </span>
                  <span>
                    <span className="text-gray-400">Peso neto de racimo: </span>
                    {pesoNetoRacimo !== null ? `${pesoNetoRacimo.toFixed(2)} kg` : '—'}
                  </span>
                  <span>
                    <span className="text-gray-400">Ratio: </span>
                    {ratio !== null ? ratio.toFixed(2) : '—'}
                  </span>
                  <span>
                    <span className="text-gray-400">Merma: </span>
                    {merma !== null ? `${merma.toFixed(1)}%` : '—'}
                  </span>
                </div>
                {totalRacimos > 0 && (
                  <p className="text-xs text-gray-500">
                    Por edad (semanas):{' '}
                    {SEMANAS_RACIMO.map((semana) => {
                      const racimos = registro[campoRacimo(semana)]
                      const grado = registro[campoGrado(semana)]
                      return `S${semana}: ${racimos}${grado !== null ? ` (grado ${grado})` : ''}`
                    }).join(' · ')}
                  </p>
                )}
              </Seccion>

              <Seccion titulo="Canastillas">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <span>
                    <span className="text-gray-400">Cantidad: </span>
                    {registro.canastillas.toLocaleString('es')}
                  </span>
                  <span>
                    <span className="text-gray-400">Kilos: </span>
                    {kilosCanastillas.toLocaleString('es', { maximumFractionDigits: 2 })} kg
                  </span>
                </div>
              </Seccion>
            </>
          )}

          <Seccion titulo="Referencias producidas">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">Referencia</th>
                    <th className="py-1.5 pr-3 font-medium">Cajas</th>
                    <th className="py-1.5 pr-3 font-medium">Peso (kg)</th>
                    <th className="py-1.5 pr-3 font-medium">Cajas 20kg</th>
                    <th className="py-1.5 pr-3 font-medium">Rechazadas</th>
                    <th className="py-1.5 pr-3 font-medium">Motivo</th>
                    <th className="py-1.5 pr-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {registro.items.map((item) => (
                    <ItemRow key={item.id} item={item} referencias={referencias} onChanged={onChanged} />
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>

          {registro.transportes.length > 0 && (
            <Seccion titulo="Transporte">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1.5 pr-3 font-medium">Tipo</th>
                      <th className="py-1.5 pr-3 font-medium">Placa</th>
                      <th className="py-1.5 pr-3 font-medium">Sello</th>
                      <th className="py-1.5 pr-3 font-medium">Hora llegada</th>
                      <th className="py-1.5 pr-3 font-medium">Hora salida</th>
                      <th className="py-1.5 pr-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {registro.transportes.map((t) => (
                      <TransporteRow key={t.id} transporte={t} onChanged={onChanged} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          )}
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-banex-600 uppercase">
        <span className="h-3 w-0.5 shrink-0 rounded-full bg-banana-500" />
        {titulo}
      </h3>
      {children}
    </div>
  )
}

function MiniField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const smallInput =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20'

function ItemRow({
  item,
  referencias,
  onChanged,
}: {
  item: ProduccionItem
  referencias: Referencia[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item)
  const [busy, setBusy] = useState(false)

  function catalogoDe(referencia: string) {
    return referencias.find((r) => r.marca === referencia) ?? null
  }

  function cajas20kgDe() {
    const ref = catalogoDe(draft.referencia)
    return ref === null ? draft.cajas_20kg : draft.cantidad_cajas * ref.factor_conversion
  }

  async function save() {
    const ref = catalogoDe(draft.referencia)
    if (!ref) {
      alert(`"${draft.referencia}" no es una referencia del catálogo. Elige una de la lista.`)
      return
    }

    setBusy(true)
    const { error } = await supabase
      .from('produccion_items')
      .update({
        referencia: draft.referencia,
        cantidad_cajas: draft.cantidad_cajas,
        peso_neto_kg: ref.peso_neto_kg,
        cajas_20kg: draft.cantidad_cajas * ref.factor_conversion,
        cajas_rechazadas: draft.cajas_rechazadas,
        motivo_rechazo: draft.cajas_rechazadas > 0 ? draft.motivo_rechazo : null,
      })
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
    if (!confirm('¿Eliminar esta línea?')) return
    setBusy(true)
    const { error } = await supabase.from('produccion_items').delete().eq('id', item.id)
    setBusy(false)
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    onChanged()
  }

  if (!editing) {
    return (
      <tr className="border-b border-gray-100">
        <td className="py-1.5 pr-3">{item.referencia}</td>
        <td className="py-1.5 pr-3">{item.cantidad_cajas}</td>
        <td className="py-1.5 pr-3">{item.peso_neto_kg}</td>
        <td className="py-1.5 pr-3">{item.cajas_20kg.toFixed(2)}</td>
        <td className="py-1.5 pr-3">{item.cajas_rechazadas}</td>
        <td className="py-1.5 pr-3">{item.motivo_rechazo ?? '—'}</td>
        <td className="flex gap-2 py-1.5 pr-3 whitespace-nowrap">
          <button
            onClick={() => {
              setDraft(item)
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
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3">
        <input
          type="text"
          list="referencias-catalogo"
          autoComplete="off"
          value={draft.referencia}
          onChange={(e) => setDraft((d) => ({ ...d, referencia: e.target.value }))}
          className={cellInput}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="number"
          min={1}
          value={draft.cantidad_cajas}
          onChange={(e) => setDraft((d) => ({ ...d, cantidad_cajas: Number(e.target.value) }))}
          className={cellInput}
        />
      </td>
      <td className="py-1.5 pr-3 text-gray-500">{catalogoDe(draft.referencia)?.peso_neto_kg ?? draft.peso_neto_kg}</td>
      <td className="py-1.5 pr-3 text-gray-500">{cajas20kgDe().toFixed(2)}</td>
      <td className="py-1.5 pr-3">
        <input
          type="number"
          min={0}
          value={draft.cajas_rechazadas}
          onChange={(e) => setDraft((d) => ({ ...d, cajas_rechazadas: Number(e.target.value) }))}
          className={cellInput}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          value={draft.motivo_rechazo ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, motivo_rechazo: e.target.value }))}
          className={cellInput}
        />
      </td>
      <td className="flex gap-2 py-1.5 pr-3 whitespace-nowrap">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-banex-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          Guardar
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
          Cancelar
        </button>
      </td>
    </tr>
  )
}

function TransporteRow({ transporte, onChanged }: { transporte: Transporte; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(transporte)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('transportes')
      .update({
        tipo: draft.tipo,
        hora_llegada: draft.hora_llegada || null,
        hora_salida: draft.hora_salida || null,
        placa: draft.placa || null,
        sello: draft.tipo === 'Contenedor' ? draft.sello || null : null,
      })
      .eq('id', transporte.id)

    setBusy(false)
    if (error) {
      alert(`No se pudo guardar: ${error.message}`)
      return
    }
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!confirm('¿Eliminar esta unidad de transporte?')) return
    setBusy(true)
    const { error } = await supabase.from('transportes').delete().eq('id', transporte.id)
    setBusy(false)
    if (error) {
      alert(`No se pudo eliminar: ${error.message}`)
      return
    }
    onChanged()
  }

  if (!editing) {
    return (
      <tr className="border-b border-gray-100">
        <td className="py-1.5 pr-3">{transporte.tipo}</td>
        <td className="py-1.5 pr-3">{transporte.placa ?? '—'}</td>
        <td className="py-1.5 pr-3">{transporte.sello ?? '—'}</td>
        <td className="py-1.5 pr-3">{transporte.hora_llegada ?? '—'}</td>
        <td className="py-1.5 pr-3">{transporte.hora_salida ?? '—'}</td>
        <td className="flex gap-2 py-1.5 pr-3 whitespace-nowrap">
          <button
            onClick={() => {
              setDraft(transporte)
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
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3">
        <select
          value={draft.tipo}
          onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value as Transporte['tipo'] }))}
          className={cellInput}
        >
          {TIPOS_TRANSPORTE.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={draft.placa ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, placa: e.target.value.toUpperCase() }))}
          className={cellInput}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={draft.sello ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, sello: e.target.value }))}
          disabled={draft.tipo !== 'Contenedor'}
          className={`${cellInput} disabled:bg-gray-100 disabled:text-gray-400`}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="time"
          value={draft.hora_llegada ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, hora_llegada: e.target.value }))}
          className={cellInput}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="time"
          value={draft.hora_salida ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, hora_salida: e.target.value }))}
          className={cellInput}
        />
      </td>
      <td className="flex gap-2 py-1.5 pr-3 whitespace-nowrap">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-banex-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          Guardar
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
          Cancelar
        </button>
      </td>
    </tr>
  )
}

const cellInput =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-banex-500/20'

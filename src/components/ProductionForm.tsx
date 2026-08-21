import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FINCAS } from '../lib/fincas'
import { getIsoWeek } from '../lib/isoWeek'
import { useReferencias } from '../lib/useReferencias'
import { useFincas } from '../lib/useFincas'
import { useProducciones } from '../lib/useProducciones'
import SectionHeading from './SectionHeading'
import {
  CAJA_20KG_KG,
  CANASTILLA_KG,
  SEMANAS_RACIMO,
  TIPOS_TRANSPORTE,
  type ProduccionHeaderInput,
} from '../types/produccion'

function campoRacimo(semana: (typeof SEMANAS_RACIMO)[number]) {
  return `racimos_semana_${semana}` as const
}

function campoGrado(semana: (typeof SEMANAS_RACIMO)[number]) {
  return `grado_semana_${semana}` as const
}

interface ItemDraft {
  key: number
  referencia: string
  cantidad_cajas: number
  cajas_rechazadas: number
}

interface TransporteDraft {
  key: number
  tipo: string
  hora_llegada: string
  hora_salida: string
  placa: string
  sello: string
}

const initialFecha = new Date().toISOString().slice(0, 10)

const emptyHeader: ProduccionHeaderInput = {
  fecha: initialFecha,
  hora_finalizacion: null,
  semana: getIsoWeek(initialFecha),
  finca: '',
  area_recorrida: null,
  racimos_semana_7: 0,
  racimos_semana_8: 0,
  racimos_semana_9: 0,
  racimos_semana_10: 0,
  racimos_semana_11: 0,
  racimos_semana_12: 0,
  grado_semana_7: null,
  grado_semana_8: null,
  grado_semana_9: null,
  grado_semana_10: null,
  grado_semana_11: null,
  grado_semana_12: null,
  racimos_recusados: 0,
  canastillas: 0,
  notas: '',
}

let itemKeySeq = 0
function emptyItem(): ItemDraft {
  return {
    key: itemKeySeq++,
    referencia: '',
    cantidad_cajas: 0,
    cajas_rechazadas: 0,
  }
}

let transporteKeySeq = 0
function emptyTransporte(): TransporteDraft {
  return {
    key: transporteKeySeq++,
    tipo: '',
    hora_llegada: '',
    hora_salida: '',
    placa: '',
    sello: '',
  }
}

export default function ProductionForm({ onSaved }: { onSaved: () => void }) {
  const { referencias, loading: loadingReferencias, error: referenciasError } = useReferencias()
  const { fincas } = useFincas()
  const [header, setHeader] = useState<ProduccionHeaderInput>(emptyHeader)
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [transportes, setTransportes] = useState<TransporteDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { registros: registrosSemana } = useProducciones({ semana: header.semana, finca: header.finca })

  function updateHeader<K extends keyof ProduccionHeaderInput>(field: K, value: ProduccionHeaderInput[K]) {
    setHeader((prev) => ({ ...prev, [field]: value }))
  }

  const totalRacimos = SEMANAS_RACIMO.reduce((sum, semana) => sum + (header[campoRacimo(semana)] || 0), 0)
  const totalRacimosProcesados = totalRacimos - (header.racimos_recusados || 0)

  const areaTotal = fincas.find((f) => f.nombre === header.finca)?.hectareas ?? null
  const areaHoy = header.area_recorrida ?? 0
  const anioActual = header.fecha.slice(0, 4)
  const areaSemanaPrevia = registrosSemana
    .filter((r) => r.fecha.slice(0, 4) === anioActual && r.fecha !== header.fecha)
    .reduce((sum, r) => sum + (r.area_recorrida ?? 0), 0)
  const areaSemanaAcumulada = areaSemanaPrevia + areaHoy
  const porcentajeDia = areaTotal ? (areaHoy / areaTotal) * 100 : null
  const porcentajeSemana = areaTotal ? (areaSemanaAcumulada / areaTotal) * 100 : null

  function updateItem<K extends keyof ItemDraft>(key: number, field: K, value: ItemDraft[K]) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev))
  }

  function updateTransporte<K extends keyof TransporteDraft>(key: number, field: K, value: TransporteDraft[K]) {
    setTransportes((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)))
  }

  function addTransporte() {
    setTransportes((prev) => [...prev, emptyTransporte()])
  }

  function removeTransporte(key: number) {
    setTransportes((prev) => prev.filter((t) => t.key !== key))
  }

  function pesoDe(referencia: string) {
    return referencias.find((r) => r.marca === referencia)?.peso_neto_kg ?? null
  }

  function factorDe(referencia: string) {
    return referencias.find((r) => r.marca === referencia)?.factor_conversion ?? null
  }

  function cajas20kgDe(item: ItemDraft) {
    const factor = factorDe(item.referencia)
    return factor === null ? null : item.cantidad_cajas * factor
  }

  const totalCajas = items.reduce((sum, item) => sum + item.cantidad_cajas, 0)
  const totalCajas20kg = items.reduce((sum, item) => sum + (cajas20kgDe(item) ?? 0), 0)
  const kilosCajas20kg = totalCajas20kg * CAJA_20KG_KG
  const kilosCanastillas = (header.canastillas || 0) * CANASTILLA_KG
  const pesoNetoRacimo = totalRacimos > 0 ? (kilosCajas20kg + kilosCanastillas) / totalRacimos : null
  const ratio = totalRacimos > 0 ? totalCajas20kg / totalRacimos : null
  const pesoTotalRacimos = pesoNetoRacimo !== null ? totalRacimos * pesoNetoRacimo : null
  const merma = pesoTotalRacimos !== null && pesoTotalRacimos > 0 ? (kilosCanastillas / pesoTotalRacimos) * 100 : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!header.finca) {
      setError('Selecciona una finca.')
      return
    }

    for (const item of items) {
      if (!item.referencia) {
        setError('Cada línea debe tener una referencia seleccionada.')
        return
      }
      if (pesoDe(item.referencia) === null) {
        setError(`"${item.referencia}" no es una referencia del catálogo. Elige una de la lista.`)
        return
      }
      if (item.cantidad_cajas <= 0) {
        setError(`La cantidad de cajas de ${item.referencia} debe ser mayor a 0.`)
        return
      }
    }

    const referenciasUsadas = new Set(items.map((it) => it.referencia))
    if (referenciasUsadas.size !== items.length) {
      setError('No repitas la misma referencia en dos líneas; suma la cantidad en una sola.')
      return
    }

    for (const t of transportes) {
      if (!t.tipo) {
        setError('Selecciona el tipo (Contenedor o Camión) en cada línea de transporte.')
        return
      }
    }

    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('No hay sesión activa.')
      setSaving(false)
      return
    }

    const { data: registro, error: headerError } = await supabase
      .from('producciones')
      .insert({ ...header, notas: header.notas || null, user_id: user.id })
      .select('id')
      .single()

    if (headerError || !registro) {
      setError(headerError?.message ?? 'No se pudo crear el registro.')
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('produccion_items').insert(
      items.map((item) => ({
        produccion_id: registro.id,
        referencia: item.referencia,
        cantidad_cajas: item.cantidad_cajas,
        peso_neto_kg: pesoDe(item.referencia) ?? 0,
        cajas_20kg: cajas20kgDe(item) ?? 0,
        cajas_rechazadas: item.cajas_rechazadas,
        motivo_rechazo: null,
      })),
    )

    if (itemsError) {
      setSaving(false)
      setError(itemsError.message)
      return
    }

    if (transportes.length > 0) {
      const { error: transportesError } = await supabase.from('transportes').insert(
        transportes.map((t) => ({
          produccion_id: registro.id,
          tipo: t.tipo,
          hora_llegada: t.hora_llegada || null,
          hora_salida: t.hora_salida || null,
          placa: t.placa || null,
          sello: t.tipo === 'Contenedor' ? t.sello || null : null,
        })),
      )

      if (transportesError) {
        setSaving(false)
        setError(transportesError.message)
        return
      }
    }

    setSaving(false)
    setHeader({ ...emptyHeader, fecha: header.fecha, semana: header.semana, finca: header.finca })
    setItems([emptyItem()])
    setTransportes([])
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Fecha">
          <input
            type="date"
            required
            value={header.fecha}
            onChange={(e) => {
              const fecha = e.target.value
              setHeader((prev) => ({ ...prev, fecha, semana: fecha ? getIsoWeek(fecha) : prev.semana }))
            }}
            className={inputClass}
          />
        </Field>

        <Field label="Hora de finalización">
          <input
            type="time"
            value={header.hora_finalizacion ?? ''}
            onChange={(e) => updateHeader('hora_finalizacion', e.target.value || null)}
            className={inputClass}
          />
        </Field>

        <Field label="Semana">
          <input
            type="number"
            required
            min={1}
            max={53}
            step="1"
            value={header.semana || ''}
            onChange={(e) => updateHeader('semana', Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Finca">
          <select
            required
            value={header.finca}
            onChange={(e) => updateHeader('finca', e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona una finca
            </option>
            {FINCAS.map((finca) => (
              <option key={finca} value={finca}>
                {finca}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas (opcional)">
          <input
            type="text"
            value={header.notas ?? ''}
            onChange={(e) => updateHeader('notas', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <SectionHeading>Área recorrida</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Área total (ha)">
            <input type="text" disabled value={areaTotal !== null ? areaTotal.toLocaleString('es') : '—'} className={`${inputClass} disabled:bg-gray-100`} />
          </Field>
          <Field label="Área recorrida hoy (ha)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={header.area_recorrida ?? ''}
              onChange={(e) => updateHeader('area_recorrida', e.target.value === '' ? null : Number(e.target.value))}
              className={`${inputClass} disabled:bg-gray-100`}
              disabled={!header.finca}
            />
          </Field>
          <Field label="% recorrido del día">
            <input
              type="text"
              disabled
              value={porcentajeDia !== null ? `${porcentajeDia.toFixed(1)}%` : '—'}
              className={`${inputClass} disabled:bg-gray-100`}
            />
          </Field>
          <Field label="% acumulado de la semana">
            <input
              type="text"
              disabled
              value={porcentajeSemana !== null ? `${porcentajeSemana.toFixed(1)}%` : '—'}
              className={`${inputClass} disabled:bg-gray-100`}
            />
          </Field>
        </div>
        {header.finca && areaTotal === null && (
          <p className="mt-2 text-xs text-gray-500">
            Esta finca todavía no tiene hectareaje registrado. Agrégalo en Catálogo → Fincas.
          </p>
        )}
        {areaSemanaAcumulada > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Acumulado semana {header.semana}: {areaSemanaAcumulada.toLocaleString('es', { maximumFractionDigits: 2 })} ha
            recorridas{areaTotal !== null ? ` de ${areaTotal.toLocaleString('es')} ha` : ''}.
          </p>
        )}
      </div>

      <div>
        <SectionHeading>Racimos cosechados por edad (semanas)</SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {SEMANAS_RACIMO.map((semana) => (
            <div key={semana} className="rounded-lg border border-gray-200 bg-gray-50/60 p-2 transition-colors hover:border-banex-200">
              <p className="mb-1 text-xs font-semibold text-gray-500">Semana {semana}</p>
              <Field label="Racimos">
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={header[campoRacimo(semana)] || ''}
                  onChange={(e) => updateHeader(campoRacimo(semana), Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <div className="mt-1.5">
                <Field label="Grado promedio">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={header[campoGrado(semana)] ?? ''}
                    onChange={(e) =>
                      updateHeader(campoGrado(semana), e.target.value === '' ? null : Number(e.target.value))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Total racimos cosechados">
            <input type="text" disabled value={totalRacimos} className={`${inputClass} bg-gray-50 font-medium`} />
          </Field>
          <Field label="Racimos recusados">
            <input
              type="number"
              min={0}
              step="1"
              value={header.racimos_recusados || ''}
              onChange={(e) => updateHeader('racimos_recusados', Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Total racimos procesados">
            <input
              type="text"
              disabled
              value={totalRacimosProcesados}
              className={`${inputClass} bg-gray-50 font-medium`}
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionHeading>Canastillas</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Canastillas generadas">
            <input
              type="number"
              min={0}
              step="1"
              value={header.canastillas || ''}
              onChange={(e) => updateHeader('canastillas', Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Total kilos (canastillas)">
            <input
              type="text"
              disabled
              value={kilosCanastillas.toFixed(2)}
              className={`${inputClass} bg-gray-50`}
            />
          </Field>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>Referencias producidas</SectionHeading>
          {referenciasError && <span className="text-xs text-red-600">No se pudo cargar el catálogo</span>}
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, idx) => {
            const peso = pesoDe(item.referencia)
            const cajas20kg = cajas20kgDe(item)
            return (
              <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 transition-colors hover:border-banex-200">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="lg:col-span-2">
                    <Field label="Referencia">
                      <input
                        type="text"
                        required
                        disabled={loadingReferencias}
                        list="referencias-catalogo"
                        autoComplete="off"
                        value={item.referencia}
                        onChange={(e) => updateItem(item.key, 'referencia', e.target.value)}
                        className={inputClass}
                        placeholder={loadingReferencias ? 'Cargando...' : 'Escribe o elige una referencia'}
                      />
                    </Field>
                  </div>

                  <Field label="Cantidad de cajas">
                    <input
                      type="number"
                      required
                      min={1}
                      step="1"
                      value={item.cantidad_cajas || ''}
                      onChange={(e) => updateItem(item.key, 'cantidad_cajas', Number(e.target.value))}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Peso neto (kg)">
                    <input type="text" disabled value={peso ?? '—'} className={`${inputClass} bg-gray-50`} />
                  </Field>

                  <Field label="Cajas 20kg">
                    <input
                      type="text"
                      disabled
                      value={cajas20kg !== null ? cajas20kg.toFixed(2) : '—'}
                      className={`${inputClass} bg-gray-50`}
                    />
                  </Field>

                  <Field label="Cajas rechazadas">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={item.cajas_rechazadas || ''}
                      onChange={(e) => updateItem(item.key, 'cajas_rechazadas', Number(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                </div>

                {items.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
                    >
                      Quitar línea {idx + 1}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
        >
          + Agregar referencia
        </button>

        <datalist id="referencias-catalogo">
          {referencias.map((r) => (
            <option key={r.marca} value={r.marca} />
          ))}
        </datalist>
      </div>

      <div className="rounded-xl border border-banex-100 bg-banex-50/50 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Total cajas">
            <input type="text" disabled value={totalCajas} className={`${inputClass} !bg-white font-medium`} />
          </Field>
          <Field label="Total cajas 20kg">
            <input
              type="text"
              disabled
              value={totalCajas20kg.toFixed(2)}
              className={`${inputClass} !bg-white font-medium`}
            />
          </Field>
          <Field label="Kilos cajas 20kg">
            <input type="text" disabled value={kilosCajas20kg.toFixed(2)} className={`${inputClass} !bg-white`} />
          </Field>
          <Field label="Kilos canastillas">
            <input type="text" disabled value={kilosCanastillas.toFixed(2)} className={`${inputClass} !bg-white`} />
          </Field>
          <Field label="Peso neto de racimo (kg)">
            <input
              type="text"
              disabled
              value={pesoNetoRacimo !== null ? pesoNetoRacimo.toFixed(2) : '—'}
              className={`${inputClass} !bg-white font-medium`}
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:w-1/2">
          <Field label="Ratio">
            <input
              type="text"
              disabled
              value={ratio !== null ? ratio.toFixed(2) : '—'}
              className={`${inputClass} !bg-white font-medium`}
            />
          </Field>
          <Field label="Merma (%)">
            <input
              type="text"
              disabled
              value={merma !== null ? `${merma.toFixed(1)}%` : '—'}
              className={`${inputClass} !bg-white font-medium`}
            />
          </Field>
        </div>
        {pesoNetoRacimo === null && (
          <p className="mt-2 text-xs text-gray-500">
            Registra racimos cosechados (semanas 7-12) para calcular el peso neto de racimo.
          </p>
        )}
      </div>

      <div>
        <SectionHeading>Transporte</SectionHeading>

        {transportes.length > 0 && (
          <div className="flex flex-col gap-3">
            {transportes.map((t, idx) => (
              <div key={t.key} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 transition-colors hover:border-banex-200">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Tipo de unidad">
                    <select
                      required
                      value={t.tipo}
                      onChange={(e) => updateTransporte(t.key, 'tipo', e.target.value)}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Selecciona el tipo
                      </option>
                      {TIPOS_TRANSPORTE.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Placa del vehículo">
                    <input
                      type="text"
                      value={t.placa}
                      onChange={(e) => updateTransporte(t.key, 'placa', e.target.value.toUpperCase())}
                      className={inputClass}
                      placeholder="Ej. ABC123"
                    />
                  </Field>

                  <Field label="Número de sello">
                    <input
                      type="text"
                      value={t.sello}
                      onChange={(e) => updateTransporte(t.key, 'sello', e.target.value)}
                      disabled={t.tipo !== 'Contenedor'}
                      className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
                      placeholder={t.tipo === 'Contenedor' ? 'Ej. SL-123456' : 'Solo contenedores'}
                    />
                  </Field>

                  <Field label="Hora de llegada">
                    <input
                      type="time"
                      value={t.hora_llegada}
                      onChange={(e) => updateTransporte(t.key, 'hora_llegada', e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Hora de salida">
                    <input
                      type="time"
                      value={t.hora_salida}
                      onChange={(e) => updateTransporte(t.key, 'hora_salida', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeTransporte(t.key)}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
                  >
                    Quitar unidad {idx + 1}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addTransporte}
          className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
        >
          + Agregar unidad de transporte
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-banex-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50 disabled:hover:bg-banex-600 disabled:hover:shadow-sm"
        >
          {saving ? 'Guardando...' : 'Guardar registro'}
        </button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:text-gray-500'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

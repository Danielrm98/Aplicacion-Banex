import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useReferencias } from '../lib/useReferencias'
import { useFincas } from '../lib/useFincas'
import { CAJA_20KG_KG } from '../types/produccion'
import type { Referencia } from '../types/produccion'
import type { Finca } from '../types/finca'
import SectionHeading from '../components/SectionHeading'
import TabButton from '../components/TabButton'

const emptyForm = {
  marca: '',
  cajas_pallet: 0,
  peso_neto_kg: 0,
  tipo_caja: 'Convencional' as Referencia['tipo_caja'],
  especificacion: 'Larga' as Referencia['especificacion'],
}

export default function CatalogPage() {
  const [vista, setVista] = useState<'referencias' | 'fincas'>('referencias')

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Catálogo</h1>
      <p className="mb-4 text-sm text-gray-500">
        Gestiona las marcas/referencias de cajas y el hectareaje de cada finca.
      </p>

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        <TabButton active={vista === 'referencias'} onClick={() => setVista('referencias')}>
          Referencias
        </TabButton>
        <TabButton active={vista === 'fincas'} onClick={() => setVista('fincas')}>
          Fincas
        </TabButton>
      </div>

      {vista === 'referencias' ? <ReferenciasTab /> : <FincasTab />}
    </div>
  )
}

function ReferenciasTab() {
  const { referencias, loading, error, refetch } = useReferencias()
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingMarca, setDeletingMarca] = useState<string | null>(null)

  const factorConversion = form.peso_neto_kg > 0 ? form.peso_neto_kg / CAJA_20KG_KG : 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const marca = form.marca.trim().toUpperCase()

    if (!marca) {
      setFormError('Escribe el nombre de la marca/referencia.')
      return
    }
    if (form.peso_neto_kg <= 0) {
      setFormError('El peso neto debe ser mayor a 0.')
      return
    }
    if (form.cajas_pallet <= 0) {
      setFormError('Las cajas por pallet deben ser mayor a 0.')
      return
    }
    if (referencias.some((r) => r.marca === marca)) {
      setFormError(`Ya existe una referencia llamada "${marca}".`)
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('referencias').insert({
      marca,
      cajas_pallet: form.cajas_pallet,
      peso_neto_kg: form.peso_neto_kg,
      factor_conversion: factorConversion,
      tipo_caja: form.tipo_caja,
      especificacion: form.especificacion,
    })
    setSaving(false)

    if (insertError) {
      setFormError(insertError.message)
      return
    }

    setForm(emptyForm)
    refetch()
  }

  async function handleDelete(marca: string) {
    if (!confirm(`¿Eliminar la referencia "${marca}"? Si ya se usó en algún registro, no se podrá eliminar.`)) return
    setDeletingMarca(marca)
    const { error: deleteError } = await supabase.from('referencias').delete().eq('marca', marca)
    setDeletingMarca(null)

    if (deleteError) {
      alert(
        deleteError.code === '23503'
          ? `No se puede eliminar "${marca}": ya está usada en registros de producción existentes.`
          : `No se pudo eliminar: ${deleteError.message}`,
      )
      return
    }
    refetch()
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <SectionHeading>Agregar referencia</SectionHeading>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Field label="Marca / referencia">
              <input
                type="text"
                required
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                className={inputClass}
                placeholder="Ej. NUEVAREF20X5RA"
              />
            </Field>
          </div>

          <Field label="Cajas por pallet">
            <input
              type="number"
              required
              min={1}
              step="1"
              value={form.cajas_pallet || ''}
              onChange={(e) => setForm((f) => ({ ...f, cajas_pallet: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>

          <Field label="Peso neto (kg)">
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={form.peso_neto_kg || ''}
              onChange={(e) => setForm((f) => ({ ...f, peso_neto_kg: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>

          <Field label="Factor de conversión">
            <input type="text" disabled value={factorConversion ? factorConversion.toFixed(4) : '—'} className={`${inputClass} bg-gray-50`} />
          </Field>

          <Field label="Tipo de caja">
            <select
              value={form.tipo_caja}
              onChange={(e) => setForm((f) => ({ ...f, tipo_caja: e.target.value as Referencia['tipo_caja'] }))}
              className={inputClass}
            >
              <option value="Convencional">Convencional</option>
              <option value="Orgánica">Orgánica</option>
            </select>
          </Field>

          <Field label="Especificación">
            <select
              value={form.especificacion}
              onChange={(e) => setForm((f) => ({ ...f, especificacion: e.target.value as Referencia['especificacion'] }))}
              className={inputClass}
            >
              <option value="Larga">Larga</option>
              <option value="Corta">Corta</option>
            </select>
          </Field>

          {formError && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-6">{formError}</p>}

          <div className="sm:col-span-2 lg:col-span-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-banex-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Agregar referencia'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <SectionHeading>Referencias existentes ({referencias.length})</SectionHeading>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">Marca</th>
                  <th className="py-2 pr-3 font-medium">Cajas/pallet</th>
                  <th className="py-2 pr-3 font-medium">Peso neto (kg)</th>
                  <th className="py-2 pr-3 font-medium">Factor</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Especificación</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {referencias.map((r) => (
                  <ReferenciaRow
                    key={r.marca}
                    referencia={r}
                    deleting={deletingMarca === r.marca}
                    onDelete={() => handleDelete(r.marca)}
                    onSaved={refetch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function ReferenciaRow({
  referencia,
  deleting,
  onDelete,
  onSaved,
}: {
  referencia: Referencia
  deleting: boolean
  onDelete: () => void
  onSaved: () => void
}) {
  const [draftCajasPallet, setDraftCajasPallet] = useState(String(referencia.cajas_pallet))
  const [draftPesoNeto, setDraftPesoNeto] = useState(String(referencia.peso_neto_kg))
  const [draftTipoCaja, setDraftTipoCaja] = useState(referencia.tipo_caja)
  const [draftEspecificacion, setDraftEspecificacion] = useState(referencia.especificacion)
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const cajasPalletValue = Number(draftCajasPallet)
  const pesoNetoValue = Number(draftPesoNeto)
  const factorConversion = pesoNetoValue > 0 ? pesoNetoValue / CAJA_20KG_KG : 0

  const dirty =
    cajasPalletValue !== referencia.cajas_pallet ||
    pesoNetoValue !== referencia.peso_neto_kg ||
    draftTipoCaja !== referencia.tipo_caja ||
    draftEspecificacion !== referencia.especificacion

  async function guardar() {
    setRowError(null)
    if (!(cajasPalletValue > 0)) {
      setRowError('Las cajas por pallet deben ser mayor a 0.')
      return
    }
    if (!(pesoNetoValue > 0)) {
      setRowError('El peso neto debe ser mayor a 0.')
      return
    }

    setBusy(true)
    const { error } = await supabase
      .from('referencias')
      .update({
        cajas_pallet: cajasPalletValue,
        peso_neto_kg: pesoNetoValue,
        factor_conversion: factorConversion,
        tipo_caja: draftTipoCaja,
        especificacion: draftEspecificacion,
      })
      .eq('marca', referencia.marca)
    setBusy(false)

    if (error) {
      setRowError(error.message)
      return
    }
    onSaved()
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3 font-medium text-gray-900">{referencia.marca}</td>
      <td className="py-1.5 pr-3">
        <div className="w-20">
          <input
            type="number"
            min={1}
            step="1"
            value={draftCajasPallet}
            onChange={(e) => setDraftCajasPallet(e.target.value)}
            className={inputClass}
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <div className="w-24">
          <input
            type="number"
            min={0}
            step="0.01"
            value={draftPesoNeto}
            onChange={(e) => setDraftPesoNeto(e.target.value)}
            className={inputClass}
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">{factorConversion ? factorConversion.toFixed(4) : '—'}</td>
      <td className="py-1.5 pr-3">
        <select
          value={draftTipoCaja}
          onChange={(e) => setDraftTipoCaja(e.target.value as Referencia['tipo_caja'])}
          className={inputClass}
        >
          <option value="Convencional">Convencional</option>
          <option value="Orgánica">Orgánica</option>
        </select>
      </td>
      <td className="py-1.5 pr-3">
        <select
          value={draftEspecificacion}
          onChange={(e) => setDraftEspecificacion(e.target.value as Referencia['especificacion'])}
          className={inputClass}
        >
          <option value="Larga">Larga</option>
          <option value="Corta">Corta</option>
        </select>
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button
            onClick={guardar}
            disabled={!dirty || busy}
            className="rounded-md bg-banex-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
        {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
      </td>
    </tr>
  )
}

function FincasTab() {
  const { fincas, loading, error, refetch } = useFincas()
  const totalHectareas = fincas.reduce((sum, f) => sum + (f.hectareas ?? 0), 0)

  const [nombreNuevo, setNombreNuevo] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  async function agregarFinca(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const nombre = nombreNuevo.trim().toUpperCase()
    if (!nombre) {
      setFormError('Escribe el nombre de la finca.')
      return
    }
    if (fincas.some((f) => f.nombre === nombre)) {
      setFormError(`Ya existe una finca llamada "${nombre}".`)
      return
    }

    setCreando(true)
    const { error: insertError } = await supabase.from('fincas').insert({ nombre })
    setCreando(false)

    if (insertError) {
      setFormError(insertError.message)
      return
    }

    setNombreNuevo('')
    refetch()
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <SectionHeading>Agregar finca</SectionHeading>
        <form onSubmit={agregarFinca} className="flex flex-wrap items-end gap-3">
          <Field label="Nombre de la finca">
            <input
              type="text"
              required
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              className={inputClass}
              placeholder="Ej. SANTA ROSA"
            />
          </Field>
          <button
            type="submit"
            disabled={creando}
            className="rounded-lg bg-banex-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
          >
            {creando ? 'Guardando...' : 'Agregar finca'}
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>Hectareaje y ubicación por finca ({fincas.length})</SectionHeading>
          {totalHectareas > 0 && (
            <span className="text-sm text-gray-500">
              Total: <span className="font-medium text-banex-800">{totalHectareas.toLocaleString('es')} ha</span>
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-gray-500">
          La finca que agregues aquí aparece automáticamente en Registrar, Historial, Reportes y Plan. La
          latitud/longitud se usa para mostrar el pronóstico del clima en Registrar. El responsable es solo
          información de referencia por ahora: todavía no crea una cuenta de acceso para esa persona.
        </p>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">Finca</th>
                  <th className="py-2 pr-3 font-medium">Hectareaje (ha)</th>
                  <th className="py-2 pr-3 font-medium">Latitud</th>
                  <th className="py-2 pr-3 font-medium">Longitud</th>
                  <th className="py-2 pr-3 font-medium">Responsable</th>
                  <th className="py-2 pr-3 font-medium">Correo del responsable</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fincas.map((f) => (
                  <FincaRow key={f.nombre} finca={f} onSaved={refetch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function FincaRow({
  finca,
  onSaved,
}: {
  finca: Finca
  onSaved: () => void
}) {
  const nombre = finca.nombre
  const [draftHectareas, setDraftHectareas] = useState<string>(finca.hectareas != null ? String(finca.hectareas) : '')
  const [draftLat, setDraftLat] = useState<string>(finca.latitud != null ? String(finca.latitud) : '')
  const [draftLon, setDraftLon] = useState<string>(finca.longitud != null ? String(finca.longitud) : '')
  const [draftResponsableNombre, setDraftResponsableNombre] = useState(finca.responsable_nombre ?? '')
  const [draftResponsableCorreo, setDraftResponsableCorreo] = useState(finca.responsable_correo ?? '')
  const [busy, setBusy] = useState(false)

  const hectareasValue = draftHectareas === '' ? null : Number(draftHectareas)
  const latValue = draftLat === '' ? null : Number(draftLat)
  const lonValue = draftLon === '' ? null : Number(draftLon)
  const responsableNombreValue = draftResponsableNombre.trim() === '' ? null : draftResponsableNombre.trim()
  const responsableCorreoValue = draftResponsableCorreo.trim() === '' ? null : draftResponsableCorreo.trim()
  const dirty =
    hectareasValue !== finca.hectareas ||
    latValue !== finca.latitud ||
    lonValue !== finca.longitud ||
    responsableNombreValue !== finca.responsable_nombre ||
    responsableCorreoValue !== finca.responsable_correo

  async function guardar() {
    setBusy(true)
    const { error } = await supabase.from('fincas').upsert({
      nombre,
      hectareas: hectareasValue,
      latitud: latValue,
      longitud: lonValue,
      responsable_nombre: responsableNombreValue,
      responsable_correo: responsableCorreoValue,
    })
    setBusy(false)
    if (error) {
      alert(`No se pudo guardar: ${error.message}`)
      return
    }
    onSaved()
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3 font-medium text-gray-900">{nombre}</td>
      <td className="py-1.5 pr-3">
        <div className="w-28">
          <input
            type="number"
            min={0}
            step="0.01"
            value={draftHectareas}
            onChange={(e) => setDraftHectareas(e.target.value)}
            className={inputClass}
            placeholder="—"
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <div className="w-28">
          <input
            type="number"
            step="0.000001"
            value={draftLat}
            onChange={(e) => setDraftLat(e.target.value)}
            className={inputClass}
            placeholder="Ej. 10.7"
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <div className="w-28">
          <input
            type="number"
            step="0.000001"
            value={draftLon}
            onChange={(e) => setDraftLon(e.target.value)}
            className={inputClass}
            placeholder="Ej. -74.2"
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <div className="w-36">
          <input
            type="text"
            value={draftResponsableNombre}
            onChange={(e) => setDraftResponsableNombre(e.target.value)}
            className={inputClass}
            placeholder="Nombre"
          />
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <div className="w-44">
          <input
            type="email"
            value={draftResponsableCorreo}
            onChange={(e) => setDraftResponsableCorreo(e.target.value)}
            className={inputClass}
            placeholder="correo@ejemplo.com"
          />
        </div>
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        <button
          onClick={guardar}
          disabled={!dirty || busy}
          className="rounded-md bg-banex-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar
        </button>
      </td>
    </tr>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

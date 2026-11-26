import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { usePerfil, puedeEscribir } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { useTransporteDia, obtenerTransporteEntreFechas } from '../lib/useTransporteDia'
import { exportTransporteUnidadesToExcel } from '../lib/exportUtils'
import { UNIDADES_TRANSPORTE, detalleUnidad, etiquetaUnidad, transporteRegistrada, type TransporteUnidad } from '../types/transporteUnidad'
import { TIPOS_TRANSPORTE } from '../types/produccion'
import SectionHeading from '../components/SectionHeading'
import type { Finca } from '../types/finca'

const inputClase =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-60'

export default function TransportePage() {
  const { session } = useAuth()
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const esOperador = perfil?.rol === 'operador'
  const esAdminLectura = perfil?.rol === 'admin_lectura'
  const escritura = puedeEscribir(perfil)
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles = esOperador || esAdminLectura ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre)) : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [fincaSeleccionada, setFincaSeleccionada] = useState('')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (fincaSeleccionada !== fincaUnicaOperador) setFincaSeleccionada(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (fincaSeleccionada && fincasDisponibles.some((f) => f.nombre === fincaSeleccionada)) return
    const guardada = obtenerFincaActual()
    setFincaSeleccionada(guardada && fincasDisponibles.some((f) => f.nombre === guardada) ? guardada : fincasDisponibles[0].nombre)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  const { filas, loading, refetch } = useTransporteDia(fecha)
  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Transporte</h1>
      <p className="mb-6 text-sm text-gray-500">
        Plan diario de unidades (camiones/contenedores) asignadas a cada finca, y registro de su llegada. En{' '}
        <span className="font-semibold text-red-700">rojo</span> mientras no se registra la llegada; en{' '}
        <span className="font-semibold text-green-700">verde</span> ya registrada.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
      </div>

      {esAdmin && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <SectionHeading>Plan de transporte del día</SectionHeading>
          <PlanTransporteAdmin fincas={fincasOrdenadas} fecha={fecha} filas={filas} loading={loading} refetch={refetch} userId={session?.user.id ?? ''} />
        </div>
      )}

      {esAdmin && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <SectionHeading>Exportar</SectionHeading>
          <ExportarTransporteExcel />
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <SectionHeading>Registrar llegada</SectionHeading>
        {!fincaUnicaOperador && (
          <label className="mb-4 block max-w-xs text-sm">
            <span className="mb-1 block text-gray-600">Finca</span>
            <select
              value={fincaSeleccionada}
              onChange={(e) => elegirFinca(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
            >
              <option value="">Selecciona una finca</option>
              {fincasOrdenadas.map((f) => (
                <option key={f.nombre} value={f.nombre}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>
        ) : !finca ? (
          <p className="py-4 text-center text-sm text-gray-500">Selecciona una finca.</p>
        ) : (
          <RegistroTransporteFinca key={`${finca.nombre}_${fecha}`} finca={finca} fecha={fecha} filas={filas} refetch={refetch} escritura={escritura} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Exporta a Excel todo lo registrado en un rango de fechas: una fila por
// finca/día (Año, Semana, Día, Finca, llegada/salida de cada unidad ese
// día, Observación) — mismo esquema que ya usa el libro de "Reportes" para
// el transporte capturado en Registrar, aplicado a este menú.
// ============================================================
function ExportarTransporteExcel() {
  const hoy = fechaLocalHoy()
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportar() {
    setExportando(true)
    setError(null)
    try {
      const filas = await obtenerTransporteEntreFechas(desde, hasta)
      if (filas.length === 0) {
        setError('No hay nada registrado en ese rango de fechas.')
        return
      }
      await exportTransporteUnidadesToExcel(filas, `transporte_${desde}_a_${hasta}.xlsx`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Desde</span>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Hasta</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        />
      </label>
      <button
        onClick={exportar}
        disabled={exportando}
        className="rounded-lg bg-banex-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
      >
        {exportando ? 'Exportando...' : 'Exportar Excel'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}

// ============================================================
// Panel del administrador: una fila por finca, con las unidades ya
// planificadas ese día como chips (rojo = pendiente, verde = ya registrada)
// y un selector para agregar/quitar unidades de la flota fija (1-4).
// ============================================================
function PlanTransporteAdmin({
  fincas,
  fecha,
  filas,
  loading,
  refetch,
  userId,
}: {
  fincas: Finca[]
  fecha: string
  filas: TransporteUnidad[]
  loading: boolean
  refetch: () => Promise<void>
  userId: string
}) {
  const [agregando, setAgregando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function agregarUnidad(finca: string, numero: number, tipo: string, cantidadPallets: number | null) {
    setAgregando(finca)
    setError(null)
    const { error } = await supabase
      .from('transporte_unidades')
      .insert({ finca, fecha, numero_unidad: numero, tipo, cantidad_pallets: cantidadPallets, user_id: userId })
    if (error) setError(error.message)
    else await refetch()
    setAgregando(null)
  }

  async function quitarUnidad(fila: TransporteUnidad) {
    if (!confirm(`¿Quitar la Unidad ${fila.numero_unidad} de ${fila.finca}?`)) return
    const { error } = await supabase.from('transporte_unidades').delete().eq('id', fila.id)
    if (error) setError(error.message)
    else await refetch()
  }

  if (loading) return <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="divide-y divide-gray-100">
        {fincas.map((f) => {
          const filasFinca = filas.filter((x) => x.finca === f.nombre)
          return (
            <div key={f.nombre} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="w-40 shrink-0 text-sm font-medium text-gray-700">{f.nombre}</span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {filasFinca.map((fila) => {
                  const registrada = transporteRegistrada(fila)
                  const planificado = `${detalleUnidad(filasFinca, fila)} · ${fila.tipo ?? 'sin tipo'} · ${fila.cantidad_pallets ?? '—'} pallets`
                  const detalle =
                    (registrada
                      ? `${planificado} · ${fila.placa ?? '—'} · llegada ${fila.hora_llegada?.slice(0, 5) ?? '—'}`
                      : `${planificado} · Pendiente de registrar llegada`) + (fila.observaciones ? ` · Obs: ${fila.observaciones}` : '')
                  return (
                    <span
                      key={fila.id}
                      title={detalle}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        registrada ? 'border-green-200 bg-green-100 text-green-800' : 'border-red-200 bg-red-100 text-red-700'
                      }`}
                    >
                      {etiquetaUnidad(fila)}
                      <button
                        onClick={() => quitarUnidad(fila)}
                        className="rounded-full px-1 text-[10px] leading-none opacity-60 hover:opacity-100"
                        title="Quitar del plan"
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
                <AgregarUnidadFinca finca={f.nombre} disabled={agregando === f.nombre} onAgregar={agregarUnidad} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Mini-formulario para agregar una unidad al plan de una finca: el
// administrador ya decide de una vez el número de unidad, si es Camión o
// Contenedor, y cuántos pallets carga (para planear con anticipación
// cuánta fruta preparar) — el operario solo confirma/ajusta el resto al
// llegar la unidad.
// ============================================================
function AgregarUnidadFinca({
  finca,
  disabled,
  onAgregar,
}: {
  finca: string
  disabled: boolean
  onAgregar: (finca: string, numero: number, tipo: string, cantidadPallets: number | null) => Promise<void>
}) {
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('')
  const [pallets, setPallets] = useState('')

  async function agregar() {
    if (!numero || !tipo) return
    await onAgregar(finca, Number(numero), tipo, pallets ? Number(pallets) : null)
    setNumero('')
    setTipo('')
    setPallets('')
  }

  const selectClase =
    'rounded-full border border-dashed border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 focus:border-banex-500 focus:outline-none disabled:opacity-50'

  return (
    <span className="inline-flex items-center gap-1">
      <select value={numero} disabled={disabled} onChange={(e) => setNumero(e.target.value)} className={selectClase}>
        <option value="">+ Unidad</option>
        {UNIDADES_TRANSPORTE.map((n) => (
          <option key={n} value={n}>
            Unidad {n}
          </option>
        ))}
      </select>
      <select value={tipo} disabled={disabled} onChange={(e) => setTipo(e.target.value)} className={selectClase}>
        <option value="">Tipo</option>
        {TIPOS_TRANSPORTE.map((t) => (
          <option key={t} value={t}>
            {t === 'Camión' ? 'CAMIÓN' : 'CONTENEDOR'}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        placeholder="Pallets"
        value={pallets}
        disabled={disabled}
        onChange={(e) => setPallets(e.target.value)}
        className="w-20 rounded-full border border-dashed border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 focus:border-banex-500 focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={agregar}
        disabled={disabled || !numero || !tipo}
        className="rounded-full bg-banex-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        Agregar
      </button>
    </span>
  )
}

// ============================================================
// Formulario de registro de llegada para UNA finca: tira de estado
// (rojo/verde) de las unidades planificadas ese día, selector de cuál se
// está registrando, selector de tipo (Camión/Contenedor) que revela los
// campos correspondientes, y Guardar.
// ============================================================
function RegistroTransporteFinca({
  finca,
  fecha,
  filas,
  refetch,
  escritura,
}: {
  finca: Finca
  fecha: string
  filas: TransporteUnidad[]
  refetch: () => Promise<void>
  escritura: boolean
}) {
  // Filtrado por finca, en el mismo orden en que el hook las trae
  // (finca, numero_unidad, created_at) — necesario para que etiquetaUnidad
  // numere los "viajes" repetidos de forma estable.
  const filasFinca = useMemo(() => filas.filter((f) => f.finca === finca.nombre), [filas, finca.nombre])

  // Se selecciona por `id` de fila, no por número de unidad: una misma
  // unidad puede tener varias filas ese día (varios recorridos) y cada una
  // se registra por separado.
  const [filaSeleccionadaId, setFilaSeleccionadaId] = useState<string | null>(filasFinca[0]?.id ?? null)

  useEffect(() => {
    if (filasFinca.length === 0) {
      setFilaSeleccionadaId(null)
      return
    }
    if (filaSeleccionadaId === null || !filasFinca.some((f) => f.id === filaSeleccionadaId)) {
      setFilaSeleccionadaId(filasFinca[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasFinca])

  const filaActual = filasFinca.find((f) => f.id === filaSeleccionadaId) ?? null

  const [tipo, setTipo] = useState('')
  const [placa, setPlaca] = useState('')
  const [numeroContenedor, setNumeroContenedor] = useState('')
  const [selloEntrada, setSelloEntrada] = useState('')
  const [selloSalida, setSelloSalida] = useState('')
  const [horaLlegada, setHoraLlegada] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    setTipo(filaActual?.tipo ?? '')
    setPlaca(filaActual?.placa ?? '')
    setNumeroContenedor(filaActual?.numero_contenedor ?? '')
    setSelloEntrada(filaActual?.sello_entrada ?? '')
    setSelloSalida(filaActual?.sello_salida ?? '')
    setHoraLlegada(filaActual?.hora_llegada?.slice(0, 5) ?? '')
    setHoraSalida(filaActual?.hora_salida?.slice(0, 5) ?? '')
    setObservaciones(filaActual?.observaciones ?? '')
    setGuardado(false)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaActual?.id])

  async function guardar() {
    if (!filaActual) return
    setGuardando(true)
    setError(null)
    const payload = {
      ...(tipo === 'Camión'
        ? { tipo, placa: placa || null, hora_llegada: horaLlegada || null, hora_salida: horaSalida || null, numero_contenedor: null, sello_entrada: null, sello_salida: null }
        : tipo === 'Contenedor'
          ? {
              tipo,
              placa: placa || null,
              numero_contenedor: numeroContenedor || null,
              sello_entrada: selloEntrada || null,
              sello_salida: selloSalida || null,
              hora_llegada: horaLlegada || null,
              hora_salida: horaSalida || null,
            }
          : { tipo: null }),
      observaciones: observaciones || null,
    }
    const { error } = await supabase.from('transporte_unidades').update(payload).eq('id', filaActual.id)
    if (error) {
      setError(error.message)
    } else {
      setGuardado(true)
      await refetch()
      setTimeout(() => setGuardado(false), 3000)
    }
    setGuardando(false)
  }

  if (filasFinca.length === 0) {
    return <p className="py-4 text-sm text-gray-500">El administrador todavía no asignó unidades para {finca.nombre} el {fecha}.</p>
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filasFinca.map((f) => {
          const registrada = transporteRegistrada(f)
          const activa = f.id === filaSeleccionadaId
          return (
            <button
              key={f.id}
              onClick={() => setFilaSeleccionadaId(f.id)}
              title={`${detalleUnidad(filasFinca, f)}${registrada ? ` · ${f.placa ?? '—'}` : ' · Pendiente de registrar'}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                registrada ? 'border-green-200 bg-green-100 text-green-800' : 'border-red-200 bg-red-100 text-red-700'
              } ${activa ? 'ring-2 ring-banex-500 ring-offset-1' : ''}`}
            >
              {etiquetaUnidad(f)}
            </button>
          )
        })}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {filaActual?.cantidad_pallets != null && (
        <p className="mb-3 text-sm text-gray-500">
          Pallets planificados por el administrador: <span className="font-semibold text-gray-700">{filaActual.cantidad_pallets}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Tipo</span>
          <select value={tipo} disabled={!escritura} onChange={(e) => setTipo(e.target.value)} className={inputClase}>
            <option value="">Selecciona...</option>
            {TIPOS_TRANSPORTE.map((t) => (
              <option key={t} value={t}>
                {t === 'Camión' ? 'CAMIÓN' : 'CONTENEDOR'}
              </option>
            ))}
          </select>
        </label>

        {tipo === 'Camión' && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Placa</span>
              <input value={placa} disabled={!escritura} onChange={(e) => setPlaca(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Hora de llegada</span>
              <input type="time" value={horaLlegada} disabled={!escritura} onChange={(e) => setHoraLlegada(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Hora de salida</span>
              <input type="time" value={horaSalida} disabled={!escritura} onChange={(e) => setHoraSalida(e.target.value)} className={inputClase} />
            </label>
          </>
        )}

        {tipo === 'Contenedor' && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Placa del cabezote</span>
              <input value={placa} disabled={!escritura} onChange={(e) => setPlaca(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Número de contenedor</span>
              <input value={numeroContenedor} disabled={!escritura} onChange={(e) => setNumeroContenedor(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Sello de entrada</span>
              <input value={selloEntrada} disabled={!escritura} onChange={(e) => setSelloEntrada(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Hora de entrada</span>
              <input type="time" value={horaLlegada} disabled={!escritura} onChange={(e) => setHoraLlegada(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Sello de salida</span>
              <input value={selloSalida} disabled={!escritura} onChange={(e) => setSelloSalida(e.target.value)} className={inputClase} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Hora de salida</span>
              <input type="time" value={horaSalida} disabled={!escritura} onChange={(e) => setHoraSalida(e.target.value)} className={inputClase} />
            </label>
          </>
        )}

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-gray-600">Observaciones</span>
          <textarea
            value={observaciones}
            disabled={!escritura}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Novedades al llegar o salir la unidad (ej. retraso, fruta golpeada, falta de sello...)"
            className={`${inputClase} resize-y`}
          />
        </label>
      </div>

      {escritura && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando || !tipo}
            className="rounded-lg bg-banex-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          {guardado && <span className="text-sm font-medium text-green-700">Guardado.</span>}
        </div>
      )}
    </div>
  )
}

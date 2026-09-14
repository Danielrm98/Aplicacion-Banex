import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useProducciones } from '../lib/useProducciones'
import { useVentasCanastillas } from '../lib/useVentasCanastillas'
import { subirFacturaCanastilla, eliminarFacturaCanastilla, urlFacturaCanastilla } from '../lib/facturasCanastillas'
import { agregarVentaACola } from '../lib/colaCanastillas'
import { esErrorDeRed } from '../lib/colaRegistros'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual } from '../lib/fincaActual'
import type { VentaCanastilla } from '../types/ventaCanastilla'
import SectionHeading from '../components/SectionHeading'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

// Las canastillas de semanas anteriores a esta ya se vendieron por fuera de
// la aplicación, así que el acumulado arranca aquí para no dejarlas como
// pendientes por vender. Lunes de la semana ISO 37 de 2026.
const FECHA_INICIO_ACUMULADO = '2026-09-07'

export default function VentaCanastillasPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const esOperador = perfil?.rol === 'operador'
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles = esOperador
    ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre))
    : todasLasFincas
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [finca, setFinca] = useState<string>(() => obtenerFincaActual() ?? '')
  const [semana, setSemana] = useState<number>(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState<number>(new Date().getFullYear())
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (finca !== fincaUnicaOperador) setFinca(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (finca && fincasDisponibles.some((f) => f.nombre === finca)) return
    const guardada = obtenerFincaActual()
    setFinca(guardada && fincasDisponibles.some((f) => f.nombre === guardada) ? guardada : fincasDisponibles[0].nombre)
  }, [fincasDisponibles, finca, fincaUnicaOperador])

  // Se trae todo el histórico de la finca (sin filtrar por semana) porque el
  // disponible es un saldo acumulado en el tiempo, no algo que se reinicie
  // cada semana: si sobraron canastillas sin vender, siguen contando.
  const { registros: produccionesFinca } = useProducciones({ finca })
  const { ventas, loading, error, refetch } = useVentasCanastillas({ finca })

  const totalProducidoHistorico = useMemo(
    () =>
      produccionesFinca
        .filter((r) => r.fecha >= FECHA_INICIO_ACUMULADO)
        .reduce((sum, r) => sum + r.canastillas, 0),
    [produccionesFinca],
  )
  const totalVendidoHistorico = useMemo(
    () => ventas.filter((v) => v.fecha >= FECHA_INICIO_ACUMULADO).reduce((sum, v) => sum + v.cantidad, 0),
    [ventas],
  )
  const totalObsequioHistorico = useMemo(
    () => ventas.filter((v) => v.fecha >= FECHA_INICIO_ACUMULADO).reduce((sum, v) => sum + (v.cantidad_obsequio ?? 0), 0),
    [ventas],
  )
  const disponible = totalProducidoHistorico - totalVendidoHistorico - totalObsequioHistorico

  const producidoEstaSemana = useMemo(
    () =>
      produccionesFinca
        .filter((r) => r.semana === semana && r.fecha.slice(0, 4) === String(anio))
        .reduce((sum, r) => sum + r.canastillas, 0),
    [produccionesFinca, semana, anio],
  )
  const vendidoEstaSemana = useMemo(
    () =>
      ventas
        .filter((v) => v.semana === semana && v.fecha.slice(0, 4) === String(anio))
        .reduce((sum, v) => sum + v.cantidad, 0),
    [ventas, semana, anio],
  )
  const obsequioEstaSemana = useMemo(
    () =>
      ventas
        .filter((v) => v.semana === semana && v.fecha.slice(0, 4) === String(anio))
        .reduce((sum, v) => sum + (v.cantidad_obsequio ?? 0), 0),
    [ventas, semana, anio],
  )
  // El repique es aparte de lo producido en proceso: se informa, pero no
  // entra en la cuenta de "Disponible (acumulado)".
  const repiqueEstaSemana = useMemo(
    () =>
      ventas
        .filter((v) => v.semana === semana && v.fecha.slice(0, 4) === String(anio))
        .reduce((sum, v) => sum + (v.cantidad_repique ?? 0), 0),
    [ventas, semana, anio],
  )

  const ventasFiltradas = useMemo(
    () =>
      ventas.filter(
        (v) => v.semana === semana && v.fecha.slice(0, 4) === String(anio) && (!filtroFecha || v.fecha === filtroFecha),
      ),
    [ventas, semana, anio, filtroFecha],
  )

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Venta de canastillas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Las canastillas producidas se venden a terceros, y otras se obsequian al personal operativo. Registra cada
        salida con la foto de la factura de entrega y lleva el control de cuántas quedan disponibles. Las canastillas
        por repique son aparte de las producidas en proceso y no se descuentan del acumulado.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={finca}
            disabled={!!fincaUnicaOperador}
            onChange={(e) => setFinca(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {fincaUnicaOperador ? (
              <option value={finca}>{finca}</option>
            ) : (
              fincasDisponibles.map((f) => (
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

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Día (para validar)</span>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        {filtroFecha && (
          <button
            onClick={() => setFiltroFecha('')}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-banex-700 transition-colors hover:bg-banex-50"
          >
            Limpiar día
          </button>
        )}
      </div>

      {!finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ResumenTarjeta
              titulo="Producidas esta semana"
              valor={producidoEstaSemana}
              detalle={`Semana ${semana}/${anio}`}
            />
            <ResumenTarjeta
              titulo="Vendidas esta semana"
              valor={vendidoEstaSemana}
              detalle={`Semana ${semana}/${anio}`}
            />
            <ResumenTarjeta
              titulo="Obsequio esta semana"
              valor={obsequioEstaSemana}
              detalle={`Semana ${semana}/${anio}`}
            />
            <ResumenTarjeta
              titulo="Repique esta semana"
              valor={repiqueEstaSemana}
              detalle="Aparte de lo producido; no se descuenta"
            />
            <ResumenTarjeta
              titulo="Disponible (acumulado)"
              valor={disponible}
              detalle={`${totalProducidoHistorico.toLocaleString('es')} producidas − ${totalVendidoHistorico.toLocaleString('es')} vendidas − ${totalObsequioHistorico.toLocaleString('es')} obsequio, desde semana 37/2026`}
              destacado
              alerta={disponible < 0}
            />
          </div>

          <RegistrarVentaForm finca={finca} onGuardado={refetch} />

          <div className="mt-6">
            <SectionHeading>Salidas registradas</SectionHeading>
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : ventasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No hay salidas registradas para estos filtros.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {ventasFiltradas.map((venta) => (
                  <VentaRow key={venta.id} venta={venta} esAdmin={esAdmin} onChanged={refetch} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ResumenTarjeta({
  titulo,
  valor,
  detalle,
  destacado = false,
  alerta = false,
}: {
  titulo: string
  valor: number
  detalle: string
  destacado?: boolean
  alerta?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        alerta
          ? 'border-red-200 bg-red-50'
          : destacado
            ? 'border-banex-200 bg-banex-50'
            : 'border-gray-100 bg-white'
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${alerta ? 'text-red-700' : destacado ? 'text-banex-800' : 'text-gray-900'}`}>
        {valor.toLocaleString('es')}
      </p>
      <p className="mt-1 text-xs text-gray-500">{detalle}</p>
    </div>
  )
}

function RegistrarVentaForm({ finca, onGuardado }: { finca: string; onGuardado: () => void }) {
  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [obsequio, setObsequio] = useState<number | ''>('')
  const [repique, setRepique] = useState<number | ''>('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardadoSinConexion, setGuardadoSinConexion] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardadoSinConexion(false)

    const cantidadVendida = cantidad || 0
    const cantidadObsequio = obsequio || 0
    const cantidadRepique = repique || 0
    if (cantidadVendida <= 0 && cantidadObsequio <= 0 && cantidadRepique <= 0) {
      setError('Ingresa una cantidad vendida, de obsequio o por repique mayor a 0.')
      return
    }
    if (!archivo) {
      setError('Adjunta la foto de la factura de entrega.')
      return
    }

    // getSession() lee la sesión guardada en el dispositivo sin llamar a la
    // red (a diferencia de getUser()), así que funciona sin conexión.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    function limpiarFormulario() {
      setCantidad('')
      setObsequio('')
      setRepique('')
      setNotas('')
      setArchivo(null)
      for (const id of ['factura-input-camara', 'factura-input-galeria']) {
        const input = document.getElementById(id) as HTMLInputElement | null
        if (input) input.value = ''
      }
    }

    const ventaPendiente = {
      id: crypto.randomUUID(),
      userId: user.id,
      finca,
      fecha,
      semana: getIsoWeek(fecha),
      cantidad: cantidadVendida,
      cantidadObsequio,
      cantidadRepique,
      notas: notas || null,
      foto: archivo,
      fotoNombre: archivo.name,
      fotoTipo: archivo.type || 'image/jpeg',
      creadoEn: new Date().toISOString(),
      intentos: 0,
      ultimoError: null,
    }

    if (!navigator.onLine) {
      await agregarVentaACola(ventaPendiente)
      limpiarFormulario()
      setGuardadoSinConexion(true)
      return
    }

    setSaving(true)
    try {
      const rutaFactura = await subirFacturaCanastilla(finca, archivo)
      const { error: insertError } = await supabase.from('ventas_canastillas').insert({
        user_id: user.id,
        finca,
        fecha,
        semana: getIsoWeek(fecha),
        cantidad: cantidadVendida,
        cantidad_obsequio: cantidadObsequio,
        cantidad_repique: cantidadRepique,
        factura_path: rutaFactura,
        notas: notas || null,
      })
      if (insertError) throw insertError

      limpiarFormulario()
      onGuardado()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarVentaACola(ventaPendiente)
        limpiarFormulario()
        setGuardadoSinConexion(true)
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la venta.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <SectionHeading>Registrar salida</SectionHeading>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Fecha</span>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Cantidad vendida</span>
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Obsequio (personal)</span>
          <input
            type="number"
            min={0}
            value={obsequio}
            onChange={(e) => setObsequio(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Canastillas por repique</span>
          <input
            type="number"
            min={0}
            value={repique}
            onChange={(e) => setRepique(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <div className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Foto de la factura</span>
          {/* Dos botones explícitos (en vez de un solo input) porque en
              Android el selector nativo del sistema no siempre ofrece la
              cámara junto con la galería en el mismo menú (varía según el
              fabricante/navegador); así queda igual de claro en Android que
              en iOS, donde el sistema sí muestra ambas opciones juntas. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => document.getElementById('factura-input-camara')?.click()}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
            >
              📷 Tomar foto
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('factura-input-galeria')?.click()}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
            >
              🖼️ Elegir de galería
            </button>
          </div>
          <input
            id="factura-input-camara"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <input
            id="factura-input-galeria"
            type="file"
            accept="image/*"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <p className="mt-1 text-xs text-gray-500">
            {archivo ? `Seleccionada: ${archivo.name}` : 'Ninguna foto seleccionada.'}
          </p>
        </div>

        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-sm font-medium text-gray-700">Notas (opcional)</span>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. nombre del comprador"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Registrar salida'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {guardadoSinConexion && (
        <p className="mt-2 text-sm text-amber-700">
          📶 Sin conexión: la salida quedó guardada en el dispositivo y se enviará sola en cuanto vuelva la señal.
        </p>
      )}
    </form>
  )
}

function VentaRow({
  venta,
  esAdmin,
  onChanged,
}: {
  venta: VentaCanastilla
  esAdmin: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function verFactura() {
    try {
      const url = await urlFacturaCanastilla(venta.factura_path)
      window.open(url, '_blank')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo abrir la factura.')
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta venta y su factura? No se puede deshacer.')) return
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.from('ventas_canastillas').delete().eq('id', venta.id)
      if (deleteError) throw deleteError
      await eliminarFacturaCanastilla(venta.factura_path)
      onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-gray-900">{venta.fecha}</span>
        <span className="text-gray-500">Semana {venta.semana}</span>
        {venta.cantidad > 0 && (
          <span className="font-semibold text-banex-700">{venta.cantidad.toLocaleString('es')} vendidas</span>
        )}
        {venta.cantidad_obsequio > 0 && (
          <span className="font-semibold text-amber-600">{venta.cantidad_obsequio.toLocaleString('es')} obsequio</span>
        )}
        {venta.cantidad_repique > 0 && (
          <span className="font-semibold text-purple-600">{venta.cantidad_repique.toLocaleString('es')} repique</span>
        )}
        {venta.notas && <span className="text-gray-500">{venta.notas}</span>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={verFactura}
          className="rounded-md border border-banex-200 bg-white px-2 py-1 text-xs font-medium text-banex-700 transition-colors hover:bg-banex-50"
        >
          Ver factura
        </button>
        {esAdmin && (
          <button
            onClick={eliminar}
            disabled={busy}
            className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

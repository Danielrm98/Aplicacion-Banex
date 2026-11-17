import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { puedeEscribir, usePerfil } from '../lib/usePerfil'
import { useAuth } from '../lib/AuthContext'
import { useFincas } from '../lib/useFincas'
import { useProducciones } from '../lib/useProducciones'
import { useVentasCanastillas } from '../lib/useVentasCanastillas'
import { consolidadoSemanal, useConsolidadoCanastillas } from '../lib/useConsolidadoCanastillas'
import { subirFacturaCanastilla, eliminarFacturaCanastilla, urlFacturaCanastilla } from '../lib/facturasCanastillas'
import { agregarVentaACola, LIMITE_ENVIO_MS } from '../lib/colaCanastillas'
import { esErrorDeRed } from '../lib/colaRegistros'
import { conLimite } from '../lib/promesaConLimite'
import { anioDeSemana, getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual } from '../lib/fincaActual'
import { generarImagenFacturaCanastilla } from '../lib/facturaCanastillaImagen'
import { compartirOdescargarArchivo } from '../lib/compartirArchivo'
import type { VentaCanastilla } from '../types/ventaCanastilla'
import SectionHeading from '../components/SectionHeading'
import FirmaCanvas, { type FirmaCanvasRef } from '../components/FirmaCanvas'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

// Las canastillas de semanas anteriores a esta ya se vendieron por fuera de
// la aplicación, así que el acumulado arranca aquí para no dejarlas como
// pendientes por vender. Lunes de la semana ISO 37 de 2026.
const FECHA_INICIO_ACUMULADO = '2026-09-07'
const OPCION_CONSOLIDADO = '__consolidado__'

export default function VentaCanastillasPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const esOperador = perfil?.rol === 'operador'
  const esAdminLectura = perfil?.rol === 'admin_lectura'
  const escritura = puedeEscribir(perfil)
  const { fincas: todasLasFincas } = useFincas()
  // El admin_lectura solo ve las fincas que se le asignaron (igual que un
  // operador), aunque internamente no sea uno.
  const fincasDisponibles =
    esOperador || esAdminLectura ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre)) : todasLasFincas
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [finca, setFinca] = useState<string>(() => obtenerFincaActual() ?? '')
  const [semana, setSemana] = useState<number>(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (finca !== fincaUnicaOperador) setFinca(fincaUnicaOperador)
      return
    }
    if (finca === OPCION_CONSOLIDADO && esAdmin) return
    if (fincasDisponibles.length === 0) return
    if (finca && fincasDisponibles.some((f) => f.nombre === finca)) return
    const guardada = obtenerFincaActual()
    setFinca(guardada && fincasDisponibles.some((f) => f.nombre === guardada) ? guardada : fincasDisponibles[0].nombre)
  }, [fincasDisponibles, finca, fincaUnicaOperador, esAdmin])

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Venta de canastillas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Las canastillas producidas se venden a terceros, y otras se obsequian al personal operativo. Registra cada
        salida y lleva el control de cuántas quedan disponibles. Después puedes generar la factura digital de la
        salida, con nombre y firma de quien entrega y quien recibe. Las canastillas por repique son aparte de las
        producidas en proceso y no se descuentan del acumulado.
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
              <>
                {esAdmin && <option value={OPCION_CONSOLIDADO}>Todas las fincas (consolidado)</option>}
                {fincasDisponibles.map((f) => (
                  <option key={f.nombre} value={f.nombre}>
                    {f.nombre}
                  </option>
                ))}
              </>
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

      {finca === OPCION_CONSOLIDADO && esAdmin ? (
        <ConsolidadoGlobal semana={semana} anio={anio} />
      ) : !finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : (
        <VistaFinca finca={finca} semana={semana} anio={anio} esAdmin={esAdmin} escritura={escritura} />
      )}
    </div>
  )
}

function VistaFinca({
  finca,
  semana,
  anio,
  esAdmin,
  escritura,
}: {
  finca: string
  semana: number
  anio: number
  esAdmin: boolean
  escritura: boolean
}) {
  // Filtros de la lista "Salidas registradas", independientes de la semana/
  // año de arriba (esos son solo para las tarjetas de resumen): por defecto
  // se ven todas las salidas de la finca, sin necesidad de elegir semana.
  const [filtroSemanaLista, setFiltroSemanaLista] = useState<number | ''>('')
  const [filtroFecha, setFiltroFecha] = useState('')

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
        .filter((v) => v.semana === semana && anioDeSemana(v.fecha, v.semana) === anio)
        .reduce((sum, v) => sum + v.cantidad, 0),
    [ventas, semana, anio],
  )
  const obsequioEstaSemana = useMemo(
    () =>
      ventas
        .filter((v) => v.semana === semana && anioDeSemana(v.fecha, v.semana) === anio)
        .reduce((sum, v) => sum + (v.cantidad_obsequio ?? 0), 0),
    [ventas, semana, anio],
  )
  // El repique es aparte de lo producido en proceso: se informa, pero no
  // entra en la cuenta de "Disponible (acumulado)".
  const repiqueEstaSemana = useMemo(
    () =>
      ventas
        .filter((v) => v.semana === semana && anioDeSemana(v.fecha, v.semana) === anio)
        .reduce((sum, v) => sum + (v.cantidad_repique ?? 0), 0),
    [ventas, semana, anio],
  )

  // A diferencia de las tarjetas (que sí son de una semana puntual), la
  // lista de abajo muestra todas las salidas de la finca por defecto; estos
  // dos filtros son opcionales y solo se aplican si se eligen.
  const ventasFiltradas = useMemo(
    () =>
      ventas.filter(
        (v) => (filtroSemanaLista === '' || v.semana === filtroSemanaLista) && (!filtroFecha || v.fecha === filtroFecha),
      ),
    [ventas, filtroSemanaLista, filtroFecha],
  )

  return (
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

          {escritura && <RegistrarVentaForm finca={finca} onGuardado={refetch} />}

          <div className="mt-6">
            <SectionHeading>Salidas registradas</SectionHeading>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Semana</span>
                <select
                  value={filtroSemanaLista}
                  onChange={(e) => setFiltroSemanaLista(e.target.value ? Number(e.target.value) : '')}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
                >
                  <option value="">Todas las semanas</option>
                  {SEMANAS.map((s) => (
                    <option key={s} value={s}>
                      Semana {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Día</span>
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
                />
              </label>

              {(filtroSemanaLista !== '' || filtroFecha) && (
                <button
                  onClick={() => {
                    setFiltroSemanaLista('')
                    setFiltroFecha('')
                  }}
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-banex-700 transition-colors hover:bg-banex-50"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : ventasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                {filtroSemanaLista !== '' || filtroFecha
                  ? 'No hay salidas registradas para estos filtros.'
                  : 'Todavía no hay salidas registradas para esta finca.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {ventasFiltradas.map((venta) => (
                  <VentaRow key={venta.id} venta={venta} esAdmin={esAdmin} escritura={escritura} onChanged={refetch} />
                ))}
              </div>
            )}
          </div>
    </>
  )
}

function ConsolidadoGlobal({ semana, anio }: { semana: number; anio: number }) {
  const { producciones, ventas, loading, error } = useConsolidadoCanastillas(FECHA_INICIO_ACUMULADO)
  const filas = useMemo(
    () => consolidadoSemanal(producciones, ventas, FECHA_INICIO_ACUMULADO, fechaLocalHoy()),
    [producciones, ventas],
  )
  const seleccionada = filas.find((f) => f.anio === anio && f.semana === semana)

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
  if (error) return <p className="py-8 text-center text-sm text-red-600">{error}</p>

  return (
    <>
      {seleccionada ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ResumenTarjeta titulo="Generadas" valor={seleccionada.generadas} detalle={`Semana ${semana}/${anio}`} />
          <ResumenTarjeta titulo="Vendidas (proceso)" valor={seleccionada.vendidas} detalle={`Semana ${semana}/${anio}`} />
          <ResumenTarjeta titulo="Obsequio" valor={seleccionada.obsequio} detalle={`Semana ${semana}/${anio}`} />
          <ResumenTarjeta titulo="Vendidas por repique" valor={seleccionada.repique} detalle="Aparte de lo producido" />
          <ResumenTarjeta titulo="Total vendidas" valor={seleccionada.totalVendidas} detalle="Proceso + repique" />
          <ResumenTarjeta
            titulo="Existencia"
            valor={seleccionada.existencia}
            detalle="Quedan al cierre de la semana"
            destacado
            alerta={seleccionada.existencia < 0}
          />
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-500">
          Semana {semana}/{anio}: está antes del acumulado (desde la semana 37/2026) o todavía no llega.
        </p>
      )}

      <SectionHeading>Resumen semana a semana</SectionHeading>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Semana</th>
              <th className="px-2 py-2 text-right font-medium">Generadas</th>
              <th className="px-2 py-2 text-right font-medium">Vendidas</th>
              <th className="px-2 py-2 text-right font-medium">Obsequio</th>
              <th className="px-2 py-2 text-right font-medium">Repique</th>
              <th className="px-2 py-2 text-right font-medium">Total vendidas</th>
              <th className="px-4 py-2 text-right font-medium">Existencia</th>
            </tr>
          </thead>
          <tbody>
            {[...filas].reverse().map((f) => {
              const esSeleccionada = f.anio === anio && f.semana === semana
              return (
                <tr key={f.clave} className={`border-b border-gray-100 ${esSeleccionada ? 'bg-banex-50' : ''}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    Semana {f.semana}/{f.anio}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">{f.generadas.toLocaleString('es')}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{f.vendidas.toLocaleString('es')}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{f.obsequio.toLocaleString('es')}</td>
                  <td className="px-2 py-2 text-right text-purple-600">{f.repique.toLocaleString('es')}</td>
                  <td className="px-2 py-2 text-right font-semibold text-banex-700">{f.totalVendidas.toLocaleString('es')}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${f.existencia < 0 ? 'text-red-600' : 'text-banex-800'}`}
                  >
                    {f.existencia.toLocaleString('es')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
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
  const { session } = useAuth()
  const [fecha, setFecha] = useState(fechaLocalHoy())
  // Semana a la que corresponde la venta. Por defecto es la de la fecha, pero
  // puede ser otra (p. ej. canastillas de la semana 40 que se venden en la 41).
  const [semanaElegida, setSemanaElegida] = useState<number | null>(null)
  const semanaVenta = semanaElegida ?? getIsoWeek(fecha)
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [obsequio, setObsequio] = useState<number | ''>('')
  const [repique, setRepique] = useState<number | ''>('')
  const [notas, setNotas] = useState('')
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

    const user = session?.user
    if (!user) return

    function limpiarFormulario() {
      setSemanaElegida(null)
      setCantidad('')
      setObsequio('')
      setRepique('')
      setNotas('')
    }

    const ventaPendiente = {
      id: crypto.randomUUID(),
      userId: user.id,
      finca,
      fecha,
      semana: semanaVenta,
      cantidad: cantidadVendida,
      cantidadObsequio,
      cantidadRepique,
      notas: notas || null,
      // La factura ya no se adjunta como foto: se genera digital después
      // (botón "Generar factura" en la lista), con firmas.
      foto: null,
      fotoNombre: null,
      fotoTipo: null,
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
      await conLimite(
        (async () => {
          const { error: insertError } = await supabase.from('ventas_canastillas').insert({
            user_id: user.id,
            finca,
            fecha,
            semana: semanaVenta,
            cantidad: cantidadVendida,
            cantidad_obsequio: cantidadObsequio,
            cantidad_repique: cantidadRepique,
            notas: notas || null,
          })
          if (insertError) throw insertError
        })(),
        LIMITE_ENVIO_MS,
      )

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
          <span className="mb-1 block text-sm font-medium text-gray-700">Semana en la que fueron producidas</span>
          <select
            value={semanaVenta}
            onChange={(e) => setSemanaElegida(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          >
            {SEMANAS.map((s) => (
              <option key={s} value={s}>
                Semana {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Venta de canastillas del proceso</span>
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
          <span className="mb-1 block text-sm font-medium text-gray-700">Vendidas por repique</span>
          <input
            type="number"
            min={0}
            value={repique}
            onChange={(e) => setRepique(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>

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
  escritura,
  onChanged,
}: {
  venta: VentaCanastilla
  esAdmin: boolean
  escritura: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [agregandoFactura, setAgregandoFactura] = useState(false)
  const [editando, setEditando] = useState(false)

  async function verFactura() {
    if (!venta.factura_path) return
    try {
      const url = await urlFacturaCanastilla(venta.factura_path)
      window.open(url, '_blank')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo abrir la factura.')
    }
  }

  async function compartirFactura() {
    if (!venta.factura_path) return
    setBusy(true)
    try {
      const url = await urlFacturaCanastilla(venta.factura_path)
      const respuesta = await fetch(url)
      const blob = await respuesta.blob()
      const extension = venta.factura_path.split('.').pop() || 'jpg'
      const archivo = new File([blob], `factura-${venta.fecha}.${extension}`, { type: blob.type || 'image/jpeg' })
      const resultado = await compartirOdescargarArchivo(archivo, {
        titulo: 'Factura de canastillas',
        texto: `Factura de canastillas — ${venta.finca} — ${venta.fecha}`,
      })
      if (resultado === 'descargado') {
        alert(
          'Tu navegador no permite compartir directo a WhatsApp desde aquí: se descargó la imagen, ábrela desde tus descargas y adjúntala en WhatsApp.',
        )
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo compartir la factura.')
    } finally {
      setBusy(false)
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta venta y su factura? No se puede deshacer.')) return
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.from('ventas_canastillas').delete().eq('id', venta.id)
      if (deleteError) throw deleteError
      if (venta.factura_path) await eliminarFacturaCanastilla(venta.factura_path)
      onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          {(venta.entregado_por || venta.recibido_por) && (
            <span className="text-gray-500">
              {venta.entregado_por && `Entrega: ${venta.entregado_por}`}
              {venta.entregado_por && venta.recibido_por && ' · '}
              {venta.recibido_por && `Recibe: ${venta.recibido_por}`}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {venta.factura_path ? (
            <>
              <button
                onClick={verFactura}
                className="rounded-md border border-banex-200 bg-white px-2 py-1 text-xs font-medium text-banex-700 transition-colors hover:bg-banex-50"
              >
                Ver factura
              </button>
              <button
                onClick={compartirFactura}
                disabled={busy}
                className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
              >
                📤 Compartir
              </button>
            </>
          ) : (
            escritura && (
              <button
                onClick={() => setAgregandoFactura((v) => !v)}
                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                🧾 Generar factura
              </button>
            )
          )}
          {esAdmin && (
            <>
              <button
                onClick={() => setEditando((v) => !v)}
                disabled={busy}
                className="rounded-md border border-banex-200 bg-white px-2 py-1 text-xs font-medium text-banex-700 transition-colors hover:bg-banex-50 disabled:opacity-50"
              >
                Editar
              </button>
              <button
                onClick={eliminar}
                disabled={busy}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {editando && (
        <EditarVentaForm
          venta={venta}
          onGuardado={() => {
            setEditando(false)
            onChanged()
          }}
          onCancelar={() => setEditando(false)}
        />
      )}

      {agregandoFactura && (
        <AgregarFacturaForm
          venta={venta}
          onGuardado={() => {
            setAgregandoFactura(false)
            onChanged()
          }}
          onCancelar={() => setAgregandoFactura(false)}
        />
      )}
    </div>
  )
}

function EditarVentaForm({
  venta,
  onGuardado,
  onCancelar,
}: {
  venta: VentaCanastilla
  onGuardado: () => void
  onCancelar: () => void
}) {
  const [fecha, setFecha] = useState(venta.fecha)
  const [semanaEditada, setSemanaEditada] = useState(venta.semana)
  const [cantidad, setCantidad] = useState<number | ''>(venta.cantidad)
  const [obsequio, setObsequio] = useState<number | ''>(venta.cantidad_obsequio)
  const [repique, setRepique] = useState<number | ''>(venta.cantidad_repique)
  const [notas, setNotas] = useState(venta.notas ?? '')
  const [entregadoPor, setEntregadoPor] = useState(venta.entregado_por ?? '')
  const [recibidoPor, setRecibidoPor] = useState(venta.recibido_por ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const cantidadVendida = cantidad || 0
    const cantidadObsequio = obsequio || 0
    const cantidadRepique = repique || 0
    if (cantidadVendida <= 0 && cantidadObsequio <= 0 && cantidadRepique <= 0) {
      setError('Ingresa una cantidad vendida, de obsequio o por repique mayor a 0.')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const { error: updateError } = await conLimite(
        supabase
          .from('ventas_canastillas')
          .update({
            fecha,
            semana: semanaEditada,
            cantidad: cantidadVendida,
            cantidad_obsequio: cantidadObsequio,
            cantidad_repique: cantidadRepique,
            notas: notas || null,
            entregado_por: entregadoPor || null,
            recibido_por: recibidoPor || null,
          })
          .eq('id', venta.id),
        LIMITE_ENVIO_MS,
      )
      if (updateError) throw updateError
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  const campoClase =
    'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20'

  return (
    <form onSubmit={guardar} className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Fecha</span>
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={campoClase} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Semana</span>
          <select value={semanaEditada} onChange={(e) => setSemanaEditada(Number(e.target.value))} className={campoClase}>
            {SEMANAS.map((s) => (
              <option key={s} value={s}>
                Semana {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Vendidas</span>
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
            className={`w-28 ${campoClase}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Obsequio</span>
          <input
            type="number"
            min={0}
            value={obsequio}
            onChange={(e) => setObsequio(e.target.value === '' ? '' : Number(e.target.value))}
            className={`w-28 ${campoClase}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Repique</span>
          <input
            type="number"
            min={0}
            value={repique}
            onChange={(e) => setRepique(e.target.value === '' ? '' : Number(e.target.value))}
            className={`w-28 ${campoClase}`}
          />
        </label>
        <label className="block min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-700">Notas</span>
          <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={`w-full ${campoClase}`} />
        </label>
        <label className="block min-w-[140px]">
          <span className="mb-1 block text-xs font-medium text-gray-700">Entregado por</span>
          <input
            type="text"
            value={entregadoPor}
            onChange={(e) => setEntregadoPor(e.target.value)}
            className={`w-full ${campoClase}`}
          />
        </label>
        <label className="block min-w-[140px]">
          <span className="mb-1 block text-xs font-medium text-gray-700">Recibido por</span>
          <input
            type="text"
            value={recibidoPor}
            onChange={(e) => setRecibidoPor(e.target.value)}
            className={`w-full ${campoClase}`}
          />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-banex-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </form>
  )
}

function AgregarFacturaForm({
  venta,
  onGuardado,
  onCancelar,
}: {
  venta: VentaCanastilla
  onGuardado: () => void
  onCancelar: () => void
}) {
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <GenerarFacturaDigitalForm venta={venta} onGuardado={onGuardado} onCancelar={onCancelar} />
    </div>
  )
}

function GenerarFacturaDigitalForm({
  venta,
  onGuardado,
  onCancelar,
}: {
  venta: VentaCanastilla
  onGuardado: () => void
  onCancelar: () => void
}) {
  const [entregadoPor, setEntregadoPor] = useState('')
  const [recibidoPor, setRecibidoPor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facturaGenerada, setFacturaGenerada] = useState<File | null>(null)
  const firmaEntregaRef = useRef<FirmaCanvasRef>(null)
  const firmaRecibeRef = useRef<FirmaCanvasRef>(null)

  const previewUrl = useMemo(() => (facturaGenerada ? URL.createObjectURL(facturaGenerada) : null), [facturaGenerada])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function generar() {
    if (!recibidoPor.trim()) {
      setError('Escribe el nombre de quien recibe.')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const archivo = await generarImagenFacturaCanastilla({
        finca: venta.finca,
        fecha: venta.fecha,
        semana: venta.semana,
        cantidad: venta.cantidad,
        cantidadRepique: venta.cantidad_repique,
        notas: venta.notas,
        entregadoPor: entregadoPor.trim(),
        recibidoPor: recibidoPor.trim(),
        firmaEntrega: firmaEntregaRef.current && !firmaEntregaRef.current.estaVacia() ? firmaEntregaRef.current.obtenerCanvas() : null,
        firmaRecibe: firmaRecibeRef.current && !firmaRecibeRef.current.estaVacia() ? firmaRecibeRef.current.obtenerCanvas() : null,
      })
      await conLimite(
        (async () => {
          const ruta = await subirFacturaCanastilla(venta.finca, archivo, venta.id)
          const { error: updateError } = await supabase
            .from('ventas_canastillas')
            .update({ factura_path: ruta, entregado_por: entregadoPor.trim() || null, recibido_por: recibidoPor.trim() })
            .eq('id', venta.id)
          if (updateError) throw updateError
        })(),
        LIMITE_ENVIO_MS,
      )
      setFacturaGenerada(archivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la factura.')
    } finally {
      setGuardando(false)
    }
  }

  async function compartir() {
    if (!facturaGenerada) return
    const resultado = await compartirOdescargarArchivo(facturaGenerada, {
      titulo: 'Factura de canastillas',
      texto: `Factura de canastillas — ${venta.finca} — ${venta.fecha}`,
    })
    if (resultado === 'descargado') {
      alert(
        'Tu navegador no permite compartir directo a WhatsApp desde aquí: se descargó la imagen, ábrela desde tus descargas y adjúntala en WhatsApp.',
      )
    }
  }

  if (facturaGenerada) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-medium text-banex-700">✅ Factura generada y guardada.</p>
        {previewUrl && (
          <img src={previewUrl} alt="Factura generada" className="max-h-64 rounded-lg border border-gray-200 shadow-sm" />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={compartir}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
          >
            📤 Compartir por WhatsApp
          </button>
          <button
            type="button"
            onClick={onGuardado}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Listo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-700">Entregado por</span>
          <input
            type="text"
            value={entregadoPor}
            onChange={(e) => setEntregadoPor(e.target.value)}
            placeholder="Nombre de quien entrega"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-700">Recibido por</span>
          <input
            type="text"
            value={recibidoPor}
            onChange={(e) => setRecibidoPor(e.target.value)}
            placeholder="Nombre de quien recibe"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FirmaCanvas etiqueta="Firma de quien entrega" ref={firmaEntregaRef} />
        <FirmaCanvas etiqueta="Firma de quien recibe" ref={firmaRecibeRef} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={generar}
          disabled={guardando}
          className="rounded-md bg-banex-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
        >
          {guardando ? 'Generando...' : 'Generar y guardar factura'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

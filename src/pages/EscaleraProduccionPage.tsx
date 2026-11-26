import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { sumarSemanas } from '../lib/anioEmbolses'
import { getIsoWeek, getIsoYear } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { useEscaleraProduccion } from '../lib/useEscaleraProduccion'
import { colorCintaDe, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { leerLibroExcel, procesarLibroEscalera, guardarImportacionEscalera, type ResultadoImportacion } from '../lib/importarEscaleraExcel'
import { EDADES_COSECHA, type EdadCosecha } from '../types/escaleraProduccion'
import { CAJA_20KG_KG } from '../types/produccion'
import SectionHeading from '../components/SectionHeading'
import TabButton from '../components/TabButton'
import EmbolsePorSemanaChart, { coloresPorAnio, type PuntoEmbolseSemana } from '../components/charts/EmbolsePorSemanaChart'
import type { Finca } from '../types/finca'

export default function EscaleraProduccionPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const esAdminLectura = perfil?.rol === 'admin_lectura'
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles =
    esOperador || esAdminLectura ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre)) : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [fincaSeleccionada, setFincaSeleccionada] = useState('')
  const [vista, setVista] = useState<'escalera' | 'modelo' | 'importar'>('escalera')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (fincaSeleccionada !== fincaUnicaOperador) setFincaSeleccionada(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (fincaSeleccionada && fincasDisponibles.some((f) => f.nombre === fincaSeleccionada)) return
    const guardada = obtenerFincaActual()
    if (guardada && fincasDisponibles.some((f) => f.nombre === guardada)) setFincaSeleccionada(guardada)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Escalera de producción</h1>
      <p className="mb-6 text-sm text-gray-500">
        Proyecta, a partir del embolse semanal, en qué semana se va a cosechar cada cohorte, cuántos racimos y cuántas
        cajas va a rendir. Verde = dato real; celeste = proyección.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={fincaSeleccionada}
            disabled={!!fincaUnicaOperador}
            onChange={(e) => elegirFinca(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {!fincaUnicaOperador && <option value="">Selecciona una finca</option>}
            {fincasOrdenadas.map((f) => (
              <option key={f.nombre} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabButton active={vista === 'escalera'} onClick={() => setVista('escalera')}>
          Escalera
        </TabButton>
        <TabButton active={vista === 'modelo'} onClick={() => setVista('modelo')}>
          Modelo de cajas
        </TabButton>
        <TabButton active={vista === 'importar'} onClick={() => setVista('importar')}>
          Importar Excel
        </TabButton>
      </div>

      {vista === 'importar' ? (
        <ImportarExcelTab fincasConocidas={fincasOrdenadas.map((f) => f.nombre)} />
      ) : !finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : vista === 'escalera' ? (
        <EscaleraTabla key={finca.nombre} finca={finca} />
      ) : (
        <ModeloCajasTab key={finca.nombre} finca={finca} />
      )}
    </div>
  )
}

// ============================================================
// Tabla de solo lectura, estilo hoja de cálculo: semana de embolse → semana
// de cosecha, con lo real ya cargado (embolses + producciones.racimos_semana_X
// del formulario diario de Registrar) y lo futuro proyectado.
// ============================================================
function EscaleraTabla({ finca }: { finca: Finca }) {
  const {
    filas,
    serieBellPorHa,
    ratioCajas20kgPorRacimo,
    ratioCajasFisicasPorRacimo,
    ratioCortaPorRacimo,
    ratioPremiumPorRacimo,
    metricasPorSemana,
    recobroProyectado,
    loading,
    anioActual,
    semanaActual,
  } = useEscaleraProduccion(finca)

  const datosGrafico = useMemo<{ data: PuntoEmbolseSemana[]; series: ReturnType<typeof coloresPorAnio> }>(() => {
    const anios = [...new Set(serieBellPorHa.map((p) => p.anio))].sort((a, b) => b - a).slice(0, 3)
    const series = coloresPorAnio(anios)
    const porSemana = new Map<number, PuntoEmbolseSemana>()
    for (let s = 1; s <= 52; s++) porSemana.set(s, { semana: s })
    for (const p of serieBellPorHa) {
      if (!anios.includes(p.anio) || p.semana > 52) continue
      const fila = porSemana.get(p.semana)!
      fila[String(p.anio)] = p.valor
    }
    return { data: [...porSemana.values()], series }
  }, [serieBellPorHa])

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>

  const celdaReal = 'border border-gray-200 px-1.5 py-1 text-center bg-green-100 text-green-800'
  const celdaEstimada = 'border border-gray-200 px-1.5 py-1 text-center bg-cyan-100 text-cyan-800'
  const celdaNeutra = 'border border-gray-200 px-2 py-1 text-center text-gray-700'
  // Columnas del Excel para las que todavía no hay una fuente de datos
  // clara en la app (Motivo de Repique, Precipitación) — se dejan ya en la
  // tabla, marcadas, para irlas cuadrando una por una en vez de inventar un
  // cálculo a ciegas.
  const celdaPendiente = 'border border-gray-200 px-2 py-1 text-center text-gray-300 italic'
  const TITULO_PENDIENTE = 'Pendiente: todavía no hay de dónde sacar este dato en la app.'

  return (
    <div>
      <p className="mb-3 text-xs text-gray-400">
        Semana actual: {semanaActual}/{anioActual}. Proyección con el recobro real de las últimas 2 cohortes de embolse
        ya completas (Racimos cosechados + Repicados ÷ Embolsado, igual que en "Recobro"), con un piso de 95%:{' '}
        <span className="font-semibold text-gray-600">{(recobroProyectado * 100).toFixed(0)}%</span>, y el ratio cajas
        20kg/racimo de las últimas ~12 semanas: <span className="font-semibold text-gray-600">{ratioCajas20kgPorRacimo.toFixed(3)}</span>.
        Columnas en <span className="font-semibold text-green-700">verde</span> = dato real; en{' '}
        <span className="font-semibold text-cyan-700">celeste</span> = proyección.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-[2400px] border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-center text-gray-600">
              <th rowSpan={2} className="sticky left-0 z-10 border border-gray-200 bg-gray-100 px-2 py-1 font-semibold">
                Sem. Embolse
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Has
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Bell/Ha
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Embolse
              </th>
              <th colSpan={EDADES_COSECHA.length} className="border border-gray-200 bg-banex-900 px-2 py-1 font-semibold text-white">
                % por edad (semanas desde el embolse)
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Recobro
              </th>
              <th rowSpan={2} className="w-[90px] border border-gray-200 px-2 py-1 font-semibold">
                Sem. Cosecha
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Edad Prom
              </th>
              <th colSpan={3} className="border border-gray-200 bg-amber-800 px-2 py-1 font-semibold text-white">
                Repique
              </th>
              <th colSpan={4} className="border border-gray-200 bg-banex-700 px-2 py-1 font-semibold text-white">
                Racimos / Cajas
              </th>
              <th colSpan={6} className="border border-gray-200 bg-purple-800 px-2 py-1 font-semibold text-white">
                Corta / Premium
              </th>
              <th colSpan={7} className="border border-gray-200 bg-sky-800 px-2 py-1 font-semibold text-white">
                Datos reales de Registrar (solo si ya se registró esa semana)
              </th>
            </tr>
            <tr className="bg-gray-50 text-center text-gray-500">
              {EDADES_COSECHA.map((edad) => (
                <th key={edad} className="border border-gray-200 px-1.5 py-1 font-medium">
                  {edad}
                </th>
              ))}
              <th className="border border-gray-200 px-1.5 py-1 font-medium">%</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Racimos</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium" title={TITULO_PENDIENTE}>
                Motivo
              </th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Racimos cosechados</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Cajas 20kg (proy.)</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Cajas físicas (proy.)</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Peso de caja</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">% Corta</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">% Premium</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Ratio Corta</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Ratio Premium</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Cajas Corta</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Cajas Premium</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Peso racimo</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Prom. manos</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Grado prom.</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Canastillas</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Merma</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Racimos recusados</th>
              <th className="border border-gray-200 px-1.5 py-1 font-medium">Ha. recorridas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const color = colorCintaDe(f.anioEmbolse, f.semanaEmbolse)
              const estilo = ESTILO_CINTA[color]
              const cajas20kgProyectadas = f.racimosCosechados * ratioCajas20kgPorRacimo
              const cajasFisicasProyectadas = f.racimosCosechados * ratioCajasFisicasPorRacimo
              const m = metricasPorSemana.get(`${f.anioCosechaPrincipal}_${f.semanaCosechaPrincipal}`)

              // Corta/Premium: real si esa semana ya se registró (y trajo
              // alguna referencia clasificada en el catálogo); si no, se
              // proyecta con el ratio reciente de la finca — igual criterio
              // que Cajas 20kg/Cajas físicas.
              const hayCortaPremiumReal = m != null && m.porcentajeCorta != null
              const cajasCorta = hayCortaPremiumReal ? m!.cajas20kgCorta : f.racimosCosechados * ratioCortaPorRacimo
              const cajasPremium = hayCortaPremiumReal ? m!.cajas20kgPremium : f.racimosCosechados * ratioPremiumPorRacimo
              const totalCortaPremium = cajasCorta + cajasPremium
              const porcentajeCorta = totalCortaPremium > 0 ? cajasCorta / totalCortaPremium : null
              const porcentajePremium = totalCortaPremium > 0 ? cajasPremium / totalCortaPremium : null
              const ratioCorta = f.racimosCosechados > 0 ? cajasCorta / f.racimosCosechados : null
              const ratioPremium = f.racimosCosechados > 0 ? cajasPremium / f.racimosCosechados : null
              const celdaCortaPremium = hayCortaPremiumReal ? celdaReal : celdaEstimada

              return (
                <tr key={`${f.anioEmbolse}_${f.semanaEmbolse}`}>
                  <td className="sticky left-0 z-10 border border-gray-200 bg-white px-2 py-1 text-center">
                    <span
                      className="inline-block min-w-[52px] rounded px-1.5 py-0.5 font-semibold"
                      style={{ backgroundColor: estilo.bg, color: estilo.texto }}
                    >
                      {f.semanaEmbolse}/{f.anioEmbolse}
                    </span>
                  </td>
                  <td className={celdaNeutra}>{f.hectareas != null ? f.hectareas.toLocaleString('es') : '—'}</td>
                  <td className={celdaNeutra}>{f.bellPorHa.toFixed(1)}</td>
                  <td className={`${f.esEmbolseReal ? celdaReal : celdaEstimada} font-semibold`}>
                    {Math.round(f.embolseReal).toLocaleString('es')}
                  </td>
                  {/* Cada celda de edad se pinta según si ESA edad específica ya
                      tiene dato real (del formulario diario) o todavía es
                      proyección — esto es lo que arma la franja diagonal tipo
                      escalera, igual que en el Excel: a medida que pasan las
                      semanas, el borde real/estimado avanza una columna por fila. */}
                  {f.desglose.map((d) => (
                    <td key={d.edad} className={d.esReal ? celdaReal : celdaEstimada}>
                      {(d.porcentaje * 100).toFixed(0)}%
                    </td>
                  ))}
                  <td className={celdaNeutra}>{(f.recobro * 100).toFixed(0)}%</td>
                  <td className={celdaNeutra}>
                    {f.semanaCosechaPrincipal}/{f.anioCosechaPrincipal}
                  </td>
                  <td className={celdaNeutra}>{f.edadPromReal.toFixed(1)}</td>

                  {/* Repique */}
                  <td className={celdaNeutra}>{(f.porcentajeRepique * 100).toFixed(1)}%</td>
                  <td className={celdaNeutra}>{Math.round(f.repicado).toLocaleString('es')}</td>
                  <td className={celdaPendiente} title={TITULO_PENDIENTE}>
                    —
                  </td>

                  {/* Racimos / Cajas */}
                  <td className={`${f.esFilaReal ? celdaReal : celdaEstimada} font-semibold`}>
                    {Math.round(f.racimosCosechados).toLocaleString('es')}
                  </td>
                  <td className={`${f.esFilaReal ? celdaReal : celdaEstimada} font-semibold`}>{cajas20kgProyectadas.toFixed(1)}</td>
                  <td className={f.esFilaReal ? celdaReal : celdaEstimada}>{Math.round(cajasFisicasProyectadas).toLocaleString('es')}</td>
                  <td className={celdaNeutra}>{CAJA_20KG_KG}</td>

                  {/* Corta/Premium (Larga en el catálogo de referencias) */}
                  <td className={celdaCortaPremium}>{porcentajeCorta != null ? `${(porcentajeCorta * 100).toFixed(0)}%` : '—'}</td>
                  <td className={celdaCortaPremium}>{porcentajePremium != null ? `${(porcentajePremium * 100).toFixed(0)}%` : '—'}</td>
                  <td className={celdaCortaPremium}>{ratioCorta != null ? ratioCorta.toFixed(3) : '—'}</td>
                  <td className={celdaCortaPremium}>{ratioPremium != null ? ratioPremium.toFixed(3) : '—'}</td>
                  <td className={celdaCortaPremium}>{cajasCorta.toFixed(1)}</td>
                  <td className={celdaCortaPremium}>{cajasPremium.toFixed(1)}</td>

                  {/* Datos reales de Registrar — nunca proyectados, solo si ya se registró esa semana de cosecha */}
                  <td className={celdaNeutra}>{m?.pesoNetoRacimo != null ? m.pesoNetoRacimo.toFixed(2) : '—'}</td>
                  <td className={celdaNeutra}>{m?.promedioManos != null ? m.promedioManos.toFixed(1) : '—'}</td>
                  <td className={celdaNeutra}>{m?.gradoPromedio != null ? m.gradoPromedio.toFixed(1) : '—'}</td>
                  <td className={celdaNeutra}>{m ? m.canastillas.toLocaleString('es') : '—'}</td>
                  <td className={celdaNeutra}>{m?.merma != null ? `${m.merma.toFixed(1)}%` : '—'}</td>
                  <td className={celdaNeutra}>{m ? m.racimosRecusados.toLocaleString('es') : '—'}</td>
                  <td className={celdaNeutra}>{m ? m.areaRecorrida.toLocaleString('es') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-green-100" /> Real (ya pasó / ya registrado en Registrar)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-cyan-100" /> Estimado (proyección)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-dashed border-gray-300" /> Pendiente (todavía sin
          fuente de datos en la app: Motivo de repique, Precipitación)
        </span>
      </div>

      <div className="mt-8">
        <SectionHeading>Comparativo de Bell/Ha por semana (años recientes)</SectionHeading>
        <EmbolsePorSemanaChart data={datosGrafico.data} series={datosGrafico.series} />
      </div>
    </div>
  )
}

// ============================================================
// Pestaña "Modelo de cajas": permite modelar a mano el % de racimos por
// edad (y por lo tanto el recobro) de la finca, y muestra de inmediato el
// efecto en la proyección de cajas 20kg de las próximas 13 semanas. Si se
// guarda, ese modelo también pasa a usarse en la pestaña "Escalera".
// ============================================================
function ModeloCajasTab({ finca }: { finca: Finca }) {
  const { session } = useAuth()
  const {
    filas,
    ratioCajas20kgPorRacimo,
    distribucionProyeccion,
    modeloEsManual,
    refetchModelo,
    loading,
    anioActual,
    semanaActual,
  } = useEscaleraProduccion(finca)

  const vacio: Record<EdadCosecha, string> = { 8: '', 9: '', 10: '', 11: '', 12: '' }
  const [valores, setValores] = useState<Record<EdadCosecha, string>>(vacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  // Se sincroniza con lo que la escalera está usando de verdad (manual o
  // automático) al cargar y cada vez que cambia si hay modelo manual
  // guardado (por ejemplo, justo después de guardar o de restablecer) —
  // nunca mientras el usuario sigue editando sin haber guardado.
  useEffect(() => {
    if (loading) return
    const siguiente = {} as Record<EdadCosecha, string>
    for (const edad of EDADES_COSECHA) siguiente[edad] = (distribucionProyeccion[edad] * 100).toFixed(1)
    setValores(siguiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, modeloEsManual])

  const recobroModelado = EDADES_COSECHA.reduce((suma, edad) => suma + (Number(valores[edad]) || 0), 0)

  const proyeccion13Semanas = useMemo(() => {
    const porCosecha = new Map<string, { anio: number; semana: number; racimos: number }>()
    for (const f of filas) {
      for (const d of f.desglose) {
        const racimos = d.esReal ? d.racimos : f.embolseReal * ((Number(valores[d.edad]) || 0) / 100)
        const clave = `${d.anioCosecha}_${d.semanaCosecha}`
        const actual = porCosecha.get(clave) ?? { anio: d.anioCosecha, semana: d.semanaCosecha, racimos: 0 }
        actual.racimos += racimos
        porCosecha.set(clave, actual)
      }
    }
    const resultado: { anio: number; semana: number; racimos: number; cajas20kg: number }[] = []
    let cursor = sumarSemanas(anioActual, semanaActual, 1)
    for (let i = 0; i < 13; i++) {
      const racimos = porCosecha.get(`${cursor.anio}_${cursor.semana}`)?.racimos ?? 0
      resultado.push({ anio: cursor.anio, semana: cursor.semana, racimos, cajas20kg: racimos * ratioCajas20kgPorRacimo })
      cursor = sumarSemanas(cursor.anio, cursor.semana, 1)
    }
    return resultado
  }, [filas, valores, ratioCajas20kgPorRacimo, anioActual, semanaActual])

  const totalRacimos13Semanas = proyeccion13Semanas.reduce((suma, p) => suma + p.racimos, 0)
  const totalCajas13Semanas = proyeccion13Semanas.reduce((suma, p) => suma + p.cajas20kg, 0)

  async function guardarModelo() {
    const userId = session?.user.id
    if (!userId) return
    setError(null)
    setGuardando(true)
    try {
      const filasAGuardar = EDADES_COSECHA.map((edad) => ({
        finca: finca.nombre,
        edad_semanas: edad,
        porcentaje: Number(valores[edad]) || 0,
        updated_by: userId,
      }))
      const { error: upsertError } = await supabase
        .from('escalera_modelo_edad')
        .upsert(filasAGuardar, { onConflict: 'finca,edad_semanas' })
      if (upsertError) throw upsertError
      await refetchModelo()
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el modelo.')
    } finally {
      setGuardando(false)
    }
  }

  async function restablecerAutomatico() {
    setError(null)
    setGuardando(true)
    try {
      const { error: deleteError } = await supabase.from('escalera_modelo_edad').delete().eq('finca', finca.nombre)
      if (deleteError) throw deleteError
      await refetchModelo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer.')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>

  const campoClase =
    'w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-center text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20'

  return (
    <div>
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <SectionHeading>% de racimos cosechados por edad (modelo)</SectionHeading>
        <p className="mb-3 text-xs text-gray-500">
          {modeloEsManual
            ? 'Esta finca tiene un modelo manual guardado — se usa en vez del cálculo automático, tanto aquí como en la pestaña "Escalera".'
            : 'Mostrando el cálculo automático (última cohorte de embolse ya completa). Ajusta los valores para modelar un escenario distinto.'}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {EDADES_COSECHA.map((edad) => (
            <label key={edad} className="text-sm">
              <span className="mb-1 block text-gray-600">{edad} sem.</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={valores[edad]}
                onChange={(e) => setValores((prev) => ({ ...prev, [edad]: e.target.value }))}
                className={campoClase}
              />
            </label>
          ))}
          <div className="text-sm">
            <span className="mb-1 block text-gray-600">Recobro total</span>
            <p className="rounded-lg border border-banex-200 bg-banex-50 px-3 py-2 text-center font-semibold text-banex-800">
              {recobroModelado.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={guardarModelo}
            disabled={guardando}
            className="rounded-lg bg-banex-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar modelo'}
          </button>
          {modeloEsManual && (
            <button
              onClick={restablecerAutomatico}
              disabled={guardando}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Restablecer automático
            </button>
          )}
          {guardado && <span className="text-sm text-green-700">✅ Modelo guardado.</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <SectionHeading>Proyección de cajas 20kg — próximas 13 semanas</SectionHeading>
      <p className="mb-3 text-xs text-gray-500">
        Semana de cosecha (no de embolse): combina lo que ya viene en camino de cohortes anteriores con lo que se
        embolsaría de aquí en adelante, usando el % de arriba para lo que todavía no es real.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Semana de cosecha</th>
              <th className="px-2 py-2 text-right font-medium">Racimos cosechados (proy.)</th>
              <th className="px-2 py-2 text-right font-medium">Cajas 20kg (proy.)</th>
            </tr>
          </thead>
          <tbody>
            {proyeccion13Semanas.map((p) => (
              <tr key={`${p.anio}_${p.semana}`} className="border-b border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-900">
                  Semana {p.semana}/{p.anio}
                </td>
                <td className="px-2 py-2 text-right text-gray-700">{Math.round(p.racimos).toLocaleString('es')}</td>
                <td className="px-2 py-2 text-right font-semibold text-banex-700">{p.cajas20kg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
              <td className="px-4 py-2">Total 13 semanas</td>
              <td className="px-2 py-2 text-right">{Math.round(totalRacimos13Semanas).toLocaleString('es')}</td>
              <td className="px-2 py-2 text-right">{totalCajas13Semanas.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Pestaña "Importar Excel": arrastra (o elige) el archivo .xlsx de la
// escalera y actualiza escalera_embolse_historico/cosecha_por_edad para
// todas las fincas que reconozca en el libro. No es por finca (procesa
// todas las hojas de una vez), así que no depende del selector de arriba.
// ============================================================
function ImportarExcelTab({ fincasConocidas }: { fincasConocidas: string[] }) {
  const { session } = useAuth()
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [progreso, setProgreso] = useState<string[]>([])
  const [guardadoOk, setGuardadoOk] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function procesarArchivo(file: File) {
    setError(null)
    setResultado(null)
    setGuardadoOk(false)
    setProgreso([])
    setNombreArchivo(file.name)

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError(
        'Ese archivo no es .xlsx (puede ser .xlsb, el formato binario de Excel). Ábrelo en Excel y usa Archivo → Guardar como → "Libro de Excel (*.xlsx)", y sube ese archivo.',
      )
      return
    }

    setProcesando(true)
    try {
      const workbook = await leerLibroExcel(file)
      const hoy = fechaLocalHoy()
      const cutoffAnio = getIsoYear(hoy)
      const cutoffSemana = getIsoWeek(hoy)
      const procesado = procesarLibroEscalera(workbook, new Set(fincasConocidas), cutoffAnio, cutoffSemana)
      setResultado(procesado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo. ¿Seguro que es la escalera en .xlsx?')
    } finally {
      setProcesando(false)
    }
  }

  async function confirmarImportacion() {
    const userId = session?.user.id
    if (!resultado || !userId) return
    setError(null)
    setGuardando(true)
    try {
      await guardarImportacionEscalera(supabase, resultado, userId, (mensaje) => setProgreso((prev) => [...prev, mensaje]))
      // Para que "Escalera" y "Modelo de cajas" traigan lo recién
      // importado la próxima vez que se abran, en vez de servir lo que ya
      // tenían guardado en este dispositivo.
      for (const f of resultado.porFinca) {
        try {
          localStorage.removeItem(`approban_cache_embolse_historico_${f.finca}`)
          localStorage.removeItem(`approban_cache_cosecha_por_edad_${f.finca}`)
        } catch {
          // localStorage no disponible: sin caché que limpiar, sin consecuencia.
        }
      }
      setGuardadoOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la importación.')
    } finally {
      setGuardando(false)
    }
  }

  function limpiar() {
    setResultado(null)
    setNombreArchivo(null)
    setError(null)
    setProgreso([])
    setGuardadoOk(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Arrastra aquí el Excel de la escalera (formato <strong>.xlsx</strong>, no .xlsb) para actualizar el histórico de
        embolse y de racimos por edad de todas las fincas que reconozca. Solo toma lo que ya pasó (hasta la semana
        actual) — lo que esté más adelante en tu Excel son sus propias fórmulas de proyección, no datos reales; la app
        calcula su propia proyección aparte. Puedes subir el mismo archivo las veces que quieras: siempre actualiza, no
        duplica nada.
      </p>

      {!resultado && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            const file = e.dataTransfer.files?.[0]
            if (file) procesarArchivo(file)
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            arrastrando ? 'border-banex-500 bg-banex-50' : 'border-gray-300 bg-white hover:border-banex-300 hover:bg-banex-50/40'
          }`}
        >
          <span className="mb-2 text-3xl">📥</span>
          <p className="text-sm font-medium text-gray-700">
            {procesando ? 'Leyendo archivo...' : 'Arrastra el archivo .xlsx aquí, o haz clic para elegirlo'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) procesarArchivo(file)
            }}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {resultado && !guardadoOk && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
          <SectionHeading>Vista previa — {nombreArchivo}</SectionHeading>
          <p className="mb-3 text-sm text-gray-600">
            {resultado.totalEmbolse.toLocaleString('es')} semanas de embolse y {resultado.totalCosecha.toLocaleString('es')}{' '}
            filas de cosecha por edad, en {resultado.porFinca.length} finca(s). Revisa que los números cuadren antes de
            confirmar.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Finca</th>
                  <th className="px-2 py-2 text-right font-medium">Semanas de embolse</th>
                  <th className="px-2 py-2 text-right font-medium">Filas cosecha por edad</th>
                </tr>
              </thead>
              <tbody>
                {resultado.porFinca.map((f) => (
                  <tr key={f.hoja} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 font-medium text-gray-900">{f.finca}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{f.filasEmbolse.length.toLocaleString('es')}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{f.filasCosecha.length.toLocaleString('es')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultado.hojasOmitidas.length > 0 && (
            <p className="mt-3 text-xs text-amber-700">
              Hojas que no se importaron (no coinciden con ninguna finca del catálogo, o son resúmenes): {resultado.hojasOmitidas.join(', ')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={confirmarImportacion}
              disabled={guardando}
              className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Confirmar e importar'}
            </button>
            <button
              onClick={limpiar}
              disabled={guardando}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
          {progreso.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-gray-500">
              {progreso.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {guardadoOk && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            ✅ Importación guardada. Ve a la pestaña "Escalera" o "Modelo de cajas" para verla actualizada.
          </p>
          <button
            onClick={limpiar}
            className="mt-3 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}

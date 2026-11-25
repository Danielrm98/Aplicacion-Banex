import { useEffect, useMemo, useState } from 'react'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { useEscaleraProduccion } from '../lib/useEscaleraProduccion'
import { colorCintaDe, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { EDADES_COSECHA } from '../types/escaleraProduccion'
import SectionHeading from '../components/SectionHeading'
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

      {!finca ? <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p> : <EscaleraTabla key={finca.nombre} finca={finca} />}
    </div>
  )
}

// ============================================================
// Tabla de solo lectura, estilo hoja de cálculo: semana de embolse → semana
// de cosecha, con lo real ya cargado (embolses + producciones.racimos_semana_X
// del formulario diario de Registrar) y lo futuro proyectado.
// ============================================================
function EscaleraTabla({ finca }: { finca: Finca }) {
  const { filas, serieBellPorHa, ratioCajas20kgPorRacimo, recobroProyectado, loading, anioActual, semanaActual } = useEscaleraProduccion(finca)

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

  return (
    <div>
      <p className="mb-3 text-xs text-gray-400">
        Semana actual: {semanaActual}/{anioActual}. Proyección con el recobro real de la última cohorte ya completa:{' '}
        <span className="font-semibold text-gray-600">{(recobroProyectado * 100).toFixed(0)}%</span>, y el ratio cajas
        20kg/racimo de las últimas ~12 semanas: <span className="font-semibold text-gray-600">{ratioCajas20kgPorRacimo.toFixed(3)}</span>.
        Columnas en <span className="font-semibold text-green-700">verde</span> = dato real; en{' '}
        <span className="font-semibold text-cyan-700">celeste</span> = proyección.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] border-collapse text-xs">
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
                Racimos cosechados
              </th>
              <th rowSpan={2} className="border border-gray-200 px-2 py-1 font-semibold">
                Cajas 20kg (proy.)
              </th>
            </tr>
            <tr className="bg-gray-50 text-center text-gray-500">
              {EDADES_COSECHA.map((edad) => (
                <th key={edad} className="border border-gray-200 px-1.5 py-1 font-medium">
                  {edad}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const color = colorCintaDe(f.anioEmbolse, f.semanaEmbolse)
              const estilo = ESTILO_CINTA[color]
              const cajas20kgProyectadas = f.racimosCosechados * ratioCajas20kgPorRacimo
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
                  <td className={`${f.esFilaReal ? celdaReal : celdaEstimada} font-semibold`}>
                    {Math.round(f.racimosCosechados).toLocaleString('es')}
                  </td>
                  <td className={`${f.esFilaReal ? celdaReal : celdaEstimada} font-semibold`}>
                    {cajas20kgProyectadas.toFixed(1)}
                  </td>
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
      </div>

      <div className="mt-8">
        <SectionHeading>Comparativo de Bell/Ha por semana (años recientes)</SectionHeading>
        <EmbolsePorSemanaChart data={datosGrafico.data} series={datosGrafico.series} />
      </div>
    </div>
  )
}

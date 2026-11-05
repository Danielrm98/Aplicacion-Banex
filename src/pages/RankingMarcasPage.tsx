import { useMemo, useState } from 'react'
import FiltersBar from '../components/FiltersBar'
import TabButton from '../components/TabButton'
import { useProducciones, type Filtros } from '../lib/useProducciones'
import { useReferencias } from '../lib/useReferencias'
import { useFincas } from '../lib/useFincas'
import { usePerfil } from '../lib/usePerfil'
import { posicionFinca } from '../lib/ordenFincas'
import { semanasDelAnio } from '../lib/anioEmbolses'
import { flattenItems, cajasPorReferencia, type FilaProduccion } from '../lib/aggregations'
import type { Finca } from '../types/finca'

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function RankingMarcasPage() {
  const { perfil } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const [vista, setVista] = useState<'marcas' | 'hectarea'>('marcas')

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">Ranking de marcas</h1>
      </div>

      {esAdmin && (
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          <TabButton active={vista === 'marcas'} onClick={() => setVista('marcas')}>
            Ranking de marcas
          </TabButton>
          <TabButton active={vista === 'hectarea'} onClick={() => setVista('hectarea')}>
            Cajas por hectárea
          </TabButton>
        </div>
      )}

      {vista === 'hectarea' && esAdmin ? <CajasPorHectareaTab /> : <RankingDeMarcasTab />}
    </div>
  )
}

function RankingDeMarcasTab() {
  const [filtros, setFiltros] = useState<Filtros>({})
  const { registros, loading, error } = useProducciones(filtros)
  const { referencias } = useReferencias()

  const filas = useMemo(() => flattenItems(registros), [registros])
  const ranking = useMemo(() => cajasPorReferencia(filas), [filas])
  const totalCajas = useMemo(() => ranking.reduce((sum, r) => sum + r.cajas, 0), [ranking])
  const maximo = ranking[0]?.cajas ?? 0

  function catalogoDe(marca: string) {
    return referencias.find((r) => r.marca === marca) ?? null
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Todas las referencias producidas, ordenadas de la que más cajas acumula a la que menos.
      </p>

      <FiltersBar filtros={filtros} onChange={setFiltros} />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : ranking.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay producción para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-2 pr-3 pl-4 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Marca</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 text-right font-medium">Fincas</th>
                <th className="py-2 pr-3 text-right font-medium">Cajas</th>
                <th className="py-2 pr-3 text-right font-medium">Cajas 20kg</th>
                <th className="py-2 pr-3 text-right font-medium">% del total</th>
                <th className="py-2 pr-4 font-medium">Participación</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, idx) => {
                const catalogo = catalogoDe(r.referencia)
                const porcentaje = totalCajas > 0 ? (r.cajas / totalCajas) * 100 : 0
                const anchoBarra = maximo > 0 ? (r.cajas / maximo) * 100 : 0
                return (
                  <tr key={r.referencia} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 pl-4 text-gray-400">{idx + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-gray-900 whitespace-nowrap">{r.referencia}</td>
                    <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{catalogo?.tipo_caja ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">{r.fincas}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-banex-800">{r.cajas.toLocaleString('es')}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-700">
                      {r.cajas20kg.toLocaleString('es', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-500">{porcentaje.toFixed(1)}%</td>
                    <td className="py-1.5 pr-4">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-banex-500" style={{ width: `${anchoBarra}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function claveFincaPeriodo(finca: string, periodo: number) {
  return `${finca}::${periodo}`
}

function CajasPorHectareaTab() {
  const { fincas } = useFincas()
  const fincasOrdenadas = useMemo(
    () => [...fincas].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincas],
  )
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [agrupacion, setAgrupacion] = useState<'anio' | 'mes' | 'semana'>('anio')
  // Sin filtro: se trae toda la producción y se recorta por año acá mismo,
  // para poder cambiar de año o de agrupación sin volver a consultar.
  const { registros, loading, error } = useProducciones({})

  const filasAnio = useMemo(() => {
    const todas = flattenItems(registros)
    return todas.filter((f) => f.fecha.slice(0, 4) === String(anio))
  }, [registros, anio])

  const cajas20kgPorFinca = useMemo(() => sumarCajas20kgPorClave(filasAnio, (f) => f.finca), [filasAnio])

  const cajas20kgPorFincaYMes = useMemo(
    () => sumarCajas20kgPorClave(filasAnio, (f) => claveFincaPeriodo(f.finca, Number(f.fecha.slice(5, 7)))),
    [filasAnio],
  )

  const cajas20kgPorFincaYSemana = useMemo(
    () => sumarCajas20kgPorClave(filasAnio, (f) => claveFincaPeriodo(f.finca, f.semana)),
    [filasAnio],
  )

  const semanas = useMemo(() => semanasDelAnio(anio), [anio])

  function cajasHaDe(finca: Finca, cajas20kg: number): number | null {
    if (!finca.hectareas || finca.hectareas <= 0) return null
    return cajas20kg / finca.hectareas
  }

  function formatoCajasHa(valor: number | null) {
    return valor === null ? '—' : valor.toLocaleString('es', { maximumFractionDigits: 1 })
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Cajas de 20kg producidas por cada hectárea de finca (Cajas 20kg ÷ Hectáreas), para comparar el rendimiento
        entre fincas sin importar su tamaño.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
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
          <span className="mb-1 block text-gray-600">Ver por</span>
          <select
            value={agrupacion}
            onChange={(e) => setAgrupacion(e.target.value as 'anio' | 'mes' | 'semana')}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          >
            <option value="anio">Año completo</option>
            <option value="mes">Mes</option>
            <option value="semana">Semana</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : fincasOrdenadas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay fincas en el catálogo.</p>
      ) : agrupacion === 'anio' ? (
        <TablaAnioCompleto fincas={fincasOrdenadas} cajas20kgPorFinca={cajas20kgPorFinca} cajasHaDe={cajasHaDe} />
      ) : agrupacion === 'mes' ? (
        <TablaMatriz
          fincas={fincasOrdenadas}
          columnas={MESES_CORTO.map((nombre, idx) => ({ clave: idx + 1, titulo: nombre }))}
          cajas20kgPorFincaYPeriodo={cajas20kgPorFincaYMes}
          cajasHaDe={cajasHaDe}
          formatoCajasHa={formatoCajasHa}
        />
      ) : (
        <TablaMatriz
          fincas={fincasOrdenadas}
          columnas={semanas.map((s) => ({ clave: s.semana, titulo: String(s.semana) }))}
          cajas20kgPorFincaYPeriodo={cajas20kgPorFincaYSemana}
          cajasHaDe={cajasHaDe}
          formatoCajasHa={formatoCajasHa}
        />
      )}
    </div>
  )
}

function sumarCajas20kgPorClave(filas: FilaProduccion[], claveDe: (f: FilaProduccion) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const f of filas) {
    map.set(claveDe(f), (map.get(claveDe(f)) ?? 0) + f.cajas_20kg)
  }
  return map
}

function TablaAnioCompleto({
  fincas,
  cajas20kgPorFinca,
  cajasHaDe,
}: {
  fincas: Finca[]
  cajas20kgPorFinca: Map<string, number>
  cajasHaDe: (finca: Finca, cajas20kg: number) => number | null
}) {
  const filas = useMemo(
    () =>
      fincas
        .map((f) => {
          const cajas20kg = cajas20kgPorFinca.get(f.nombre) ?? 0
          return { finca: f, cajas20kg, cajasHa: cajasHaDe(f, cajas20kg) }
        })
        .sort((a, b) => (b.cajasHa ?? -1) - (a.cajasHa ?? -1)),
    [fincas, cajas20kgPorFinca, cajasHaDe],
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <th className="py-2 pr-3 pl-4 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Finca</th>
            <th className="py-2 pr-3 text-right font-medium">Hectáreas</th>
            <th className="py-2 pr-3 text-right font-medium">Cajas 20kg (año)</th>
            <th className="py-2 pr-4 text-right font-medium">Cajas 20kg/ha</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, idx) => (
            <tr key={f.finca.nombre} className="border-b border-gray-100">
              <td className="py-1.5 pr-3 pl-4 text-gray-400">{idx + 1}</td>
              <td className="py-1.5 pr-3 font-medium text-gray-900 whitespace-nowrap">{f.finca.nombre}</td>
              <td className="py-1.5 pr-3 text-right text-gray-500">
                {f.finca.hectareas != null ? f.finca.hectareas.toLocaleString('es') : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right text-gray-700">
                {f.cajas20kg.toLocaleString('es', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 pr-4 text-right font-semibold text-banex-800">
                {f.cajasHa !== null ? f.cajasHa.toLocaleString('es', { maximumFractionDigits: 1 }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaMatriz({
  fincas,
  columnas,
  cajas20kgPorFincaYPeriodo,
  cajasHaDe,
  formatoCajasHa,
}: {
  fincas: Finca[]
  columnas: { clave: number; titulo: string }[]
  cajas20kgPorFincaYPeriodo: Map<string, number>
  cajasHaDe: (finca: Finca, cajas20kg: number) => number | null
  formatoCajasHa: (valor: number | null) => string
}) {
  return (
    <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <th className="sticky top-0 left-0 z-[3] w-[160px] border border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">
              Finca
            </th>
            {columnas.map((c) => (
              <th
                key={c.clave}
                className="sticky top-0 z-[2] w-[56px] border border-gray-200 bg-gray-100 px-1.5 py-1.5 text-center font-medium"
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fincas.map((f) => (
            <tr key={f.nombre} className="border-b border-gray-100">
              <td className="sticky left-0 z-[1] border border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                {f.nombre}
              </td>
              {columnas.map((c) => {
                const cajas20kg = cajas20kgPorFincaYPeriodo.get(claveFincaPeriodo(f.nombre, c.clave)) ?? 0
                const cajasHa = cajas20kg > 0 ? cajasHaDe(f, cajas20kg) : f.hectareas && f.hectareas > 0 ? 0 : null
                return (
                  <td key={c.clave} className="border border-gray-200 px-2 py-1.5 text-center">
                    {formatoCajasHa(cajasHa)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

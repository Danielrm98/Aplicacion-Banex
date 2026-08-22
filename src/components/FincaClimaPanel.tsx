import { useClima } from '../lib/useClima'
import { descripcionClima } from '../lib/climaCodigos'
import { diaSemana } from '../lib/diaSemana'
import type { Finca } from '../types/finca'

function formatGrados(valor: number, positivo: string, negativo: string) {
  return `${Math.abs(valor).toFixed(4)}° ${valor >= 0 ? positivo : negativo}`
}

export default function FincaClimaPanel({ finca }: { finca: Finca | null }) {
  const tieneCoordenadas = finca?.latitud != null && finca?.longitud != null
  const { clima, loading, error } = useClima(tieneCoordenadas ? finca!.latitud : null, tieneCoordenadas ? finca!.longitud : null)

  if (!tieneCoordenadas) {
    return (
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <p className="text-sm text-gray-500">
          Esta finca todavía no tiene coordenadas registradas. Agrégalas en Catálogo → Fincas para ver su ubicación y
          el pronóstico del clima.
        </p>
      </div>
    )
  }

  const mapaUrl = `https://www.google.com/maps?q=${finca!.latitud},${finca!.longitud}`

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-banex-600 uppercase">Ubicación</p>
          <p className="text-sm text-gray-700">
            {formatGrados(finca!.latitud!, 'N', 'S')}, {formatGrados(finca!.longitud!, 'E', 'O')}
          </p>
        </div>
        <a
          href={mapaUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
        >
          Ver en el mapa ↗
        </a>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Cargando clima...</p>
      ) : error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : clima ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-banex-600 uppercase">Clima</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{descripcionClima(clima.actual.codigo).icono}</span>
              <div>
                <p className="text-lg font-semibold text-gray-900">{Math.round(clima.actual.temperatura)}°C</p>
                <p className="text-xs text-gray-500">{descripcionClima(clima.actual.codigo).texto}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <p>Humedad: {clima.actual.humedad}%</p>
              <p>Viento: {Math.round(clima.actual.vientoKmh)} km/h</p>
            </div>

            <div className="ml-auto flex gap-3">
              {clima.dias.map((d) => (
                <div key={d.fecha} className="text-center">
                  <p className="text-[10px] font-medium text-gray-500 uppercase">{diaSemana(d.fecha).slice(0, 3)}</p>
                  <p className="text-lg">{descripcionClima(d.codigo).icono}</p>
                  <p className="text-xs text-gray-700">
                    {Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°
                  </p>
                  <p className="text-[10px] text-gray-400">💧{d.probabilidadLluvia}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

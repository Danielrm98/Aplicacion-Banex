import { useState } from 'react'
import { useClima } from '../lib/useClima'
import { descripcionClima } from '../lib/climaCodigos'
import { diaSemana } from '../lib/diaSemana'
import LluviaHistorialChart from './charts/LluviaHistorialChart'
import type { Finca } from '../types/finca'

export default function FincaClimaPanel({ finca }: { finca: Finca | null }) {
  const tieneCoordenadas = finca?.latitud != null && finca?.longitud != null
  const { clima, loading, error } = useClima(tieneCoordenadas ? finca!.latitud : null, tieneCoordenadas ? finca!.longitud : null)
  const [verHistorial, setVerHistorial] = useState(false)

  if (!tieneCoordenadas) {
    return (
      <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <p className="text-sm text-gray-500">
          Esta finca todavía no tiene coordenadas registradas. Agrégalas en Catálogo → Fincas para ver el pronóstico
          del clima.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-banex-600 uppercase">Clima</p>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando clima...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : clima ? (
        <div className="flex flex-wrap items-start gap-4">
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
            <p>
              Lluvia en este momento:{' '}
              <span className={clima.actual.lluviaAhora > 0 ? 'font-medium text-blue-600' : ''}>
                {clima.actual.lluviaAhora > 0 ? `${clima.actual.lluviaAhora.toFixed(1)} mm/h` : 'sin lluvia'}
              </span>
            </p>
            <p>Acumulado hoy (con pronóstico): {clima.dias[0].precipitacionMm.toFixed(1)} mm</p>
            <p>Evapotranspiración: {clima.dias[0].evapotranspiracionMm.toFixed(1)} mm</p>
          </div>

          <div className="ml-auto flex gap-3">
            {clima.dias.map((d) => (
              <div key={d.fecha} className="text-center">
                <p className="text-[10px] font-medium text-gray-500 uppercase">{diaSemana(d.fecha).slice(0, 3)}</p>
                <p className="text-lg">{descripcionClima(d.codigo).icono}</p>
                <p className="text-xs text-gray-700">
                  {Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°
                </p>
                <p className="text-[10px] text-gray-400">💧{d.probabilidadLluvia}% · {d.precipitacionMm.toFixed(1)}mm</p>
                <p className="text-[10px] text-gray-400">ET {d.evapotranspiracionMm.toFixed(1)}mm</p>
              </div>
            ))}
          </div>

          <div className="w-full">
            <button
              onClick={() => setVerHistorial((v) => !v)}
              className="text-xs font-medium text-banex-700 hover:text-banex-800"
            >
              {verHistorial ? '▾ Ocultar historial de lluvia (14 días)' : '▸ Ver historial de lluvia (14 días)'}
            </button>
            {verHistorial && (
              <div className="mt-2">
                <LluviaHistorialChart data={clima.historialLluvia} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

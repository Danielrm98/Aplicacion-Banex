import { useEffect, useState } from 'react'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'

const LIMITE_MS = 6000

function claveCache(latitud: number, longitud: number): string {
  return `approban_cache_clima_${latitud.toFixed(2)}_${longitud.toFixed(2)}`
}

export interface ClimaActual {
  temperatura: number
  codigo: number
  humedad: number
  vientoKmh: number
  lluviaAhora: number
}

export interface ClimaDia {
  fecha: string
  codigo: number
  tempMax: number
  tempMin: number
  probabilidadLluvia: number
  precipitacionMm: number
  evapotranspiracionMm: number
}

export interface LluviaHistorialDia {
  fecha: string
  mm: number
}

export interface Clima {
  actual: ClimaActual
  dias: ClimaDia[]
  historialLluvia: LluviaHistorialDia[]
}

const DIAS_HISTORIAL = 14

/**
 * Usa Open-Meteo (no requiere API key) para traer el clima actual, un
 * pronóstico de 3 días y un historial de 14 días de lluvia a partir de la
 * latitud/longitud de una finca. `lluviaAhora` es la precipitación de la
 * última hora (lo más cercano a "está lloviendo en este momento");
 * `precipitacionMm` de cada día es un acumulado de 24h que para hoy incluye
 * horas todavía no transcurridas, por eso puede no coincidir con lo que se
 * observa en el campo en un instante dado.
 */
function construirClima(data: {
  current: { time: string; temperature_2m: number; weather_code: number; relative_humidity_2m: number; wind_speed_10m: number; precipitation: number }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
    precipitation_sum: number[]
    et0_fao_evapotranspiration: number[]
  }
}): Clima {
  const fechaHoy = data.current.time.slice(0, 10)
  const fechas = data.daily.time
  const indiceHoy = fechas.indexOf(fechaHoy)
  const corte = indiceHoy === -1 ? fechas.length - 3 : indiceHoy

  return {
    actual: {
      temperatura: data.current.temperature_2m,
      codigo: data.current.weather_code,
      humedad: data.current.relative_humidity_2m,
      vientoKmh: data.current.wind_speed_10m,
      lluviaAhora: data.current.precipitation,
    },
    dias: fechas.slice(corte).map((fecha, i) => ({
      fecha,
      codigo: data.daily.weather_code[corte + i],
      tempMax: data.daily.temperature_2m_max[corte + i],
      tempMin: data.daily.temperature_2m_min[corte + i],
      probabilidadLluvia: data.daily.precipitation_probability_max[corte + i],
      precipitacionMm: data.daily.precipitation_sum[corte + i],
      evapotranspiracionMm: data.daily.et0_fao_evapotranspiration[corte + i],
    })),
    historialLluvia: fechas.slice(0, corte).map((fecha, i) => ({
      fecha,
      mm: data.daily.precipitation_sum[i],
    })),
  }
}

export function useClima(latitud: number | null, longitud: number | null) {
  const [clima, setClima] = useState<Clima | null>(() =>
    latitud !== null && longitud !== null ? leerCacheLocal<Clima>(claveCache(latitud, longitud)) : null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (latitud === null || longitud === null) {
      setClima(null)
      setError(null)
      return
    }

    let activo = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration` +
      `&timezone=auto&forecast_days=3&past_days=${DIAS_HISTORIAL}`

    conCacheLocal<Clima>(
      claveCache(latitud, longitud),
      async () => {
        try {
          const res = await fetch(url, { signal: controller.signal })
          if (!res.ok) return { data: null, error: { message: 'No se pudo consultar el clima.' } }
          return { data: construirClima(await res.json()), error: null }
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : 'No se pudo consultar el clima.' } }
        }
      },
      undefined,
      LIMITE_MS,
    ).then(({ data, error }) => {
      if (!activo) return
      if (data) setClima(data)
      setError(data ? null : error)
      setLoading(false)
    })

    return () => {
      activo = false
      controller.abort()
    }
  }, [latitud, longitud])

  return { clima, loading, error }
}

import { useEffect, useState } from 'react'

export interface ClimaActual {
  temperatura: number
  codigo: number
  humedad: number
  vientoKmh: number
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

export interface Clima {
  actual: ClimaActual
  dias: ClimaDia[]
}

/**
 * Usa Open-Meteo (no requiere API key) para traer el clima actual y un
 * pronóstico de 3 días a partir de la latitud/longitud de una finca,
 * incluyendo mm de lluvia y evapotranspiración (útiles para riego).
 */
export function useClima(latitud: number | null, longitud: number | null) {
  const [clima, setClima] = useState<Clima | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (latitud === null || longitud === null) {
      setClima(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitud}&longitude=${longitud}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration` +
      `&timezone=auto&forecast_days=3`

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo consultar el clima.')
        return res.json()
      })
      .then((data) => {
        setClima({
          actual: {
            temperatura: data.current.temperature_2m,
            codigo: data.current.weather_code,
            humedad: data.current.relative_humidity_2m,
            vientoKmh: data.current.wind_speed_10m,
          },
          dias: (data.daily.time as string[]).map((fecha, i) => ({
            fecha,
            codigo: data.daily.weather_code[i],
            tempMax: data.daily.temperature_2m_max[i],
            tempMin: data.daily.temperature_2m_min[i],
            probabilidadLluvia: data.daily.precipitation_probability_max[i],
            precipitacionMm: data.daily.precipitation_sum[i],
            evapotranspiracionMm: data.daily.et0_fao_evapotranspiration[i],
          })),
        })
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'No se pudo consultar el clima.')
        setLoading(false)
      })

    return () => controller.abort()
  }, [latitud, longitud])

  return { clima, loading, error }
}

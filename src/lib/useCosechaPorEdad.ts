import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { CosechaPorEdad } from '../types/escaleraProduccion'

const CLAVE_CACHE_BASE = 'approban_cache_cosecha_por_edad'

/** Trae TODA la cosecha por edad de una finca (histórico importado + lo que
 * se vaya registrando semana a semana) — lo necesita el cálculo de la
 * escalera para armar la curva de distribución por edad. */
export function useCosechaPorEdad(finca: string | null) {
  const clave = `${CLAVE_CACHE_BASE}_${finca ?? ''}`
  const [filas, setFilas] = useState<CosechaPorEdad[]>(() => leerCacheLocal<CosechaPorEdad[]>(clave) ?? [])
  const [loading, setLoading] = useState(() => !!finca && leerCacheLocal<CosechaPorEdad[]>(clave) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setFilas([])
      setLoading(false)
      return
    }
    const { data, error } = await conCacheLocal<CosechaPorEdad[]>(clave, () =>
      supabase.from('cosecha_por_edad').select('*').eq('finca', finca).order('anio').order('semana'),
    )
    if (error) {
      setError(error)
    } else {
      setError(null)
      setFilas(data ?? [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, clave])

  useEffect(() => {
    const cacheado = leerCacheLocal<CosechaPorEdad[]>(clave)
    setLoading(!!finca && cacheado === null)
    if (cacheado !== null) setFilas(cacheado)
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { filas, loading, error, refetch }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { ModeloEdad } from '../types/escaleraProduccion'

const CLAVE_CACHE_BASE = 'approban_cache_modelo_edad'

/** Modelo manual (opcional) del % de racimos por edad para una finca — si
 * existe, la escalera lo usa para proyectar en vez de calcularlo solo de
 * la última cohorte real. */
export function useModeloEdad(finca: string | null) {
  const clave = `${CLAVE_CACHE_BASE}_${finca ?? ''}`
  const [filas, setFilas] = useState<ModeloEdad[]>(() => leerCacheLocal<ModeloEdad[]>(clave) ?? [])
  const [loading, setLoading] = useState(() => !!finca && leerCacheLocal<ModeloEdad[]>(clave) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setFilas([])
      setLoading(false)
      return
    }
    const { data, error } = await conCacheLocal<ModeloEdad[]>(clave, () =>
      supabase.from('escalera_modelo_edad').select('*').eq('finca', finca).order('edad_semanas'),
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
    const cacheado = leerCacheLocal<ModeloEdad[]>(clave)
    setLoading(!!finca && cacheado === null)
    if (cacheado !== null) setFilas(cacheado)
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { filas, loading, error, refetch }
}

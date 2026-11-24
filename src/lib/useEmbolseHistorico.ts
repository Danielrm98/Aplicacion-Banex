import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { EmbolseHistorico } from '../types/escaleraProduccion'

const CLAVE_CACHE_BASE = 'approban_cache_embolse_historico'

/** Semilla histórica (importada del Excel) de embolse real por finca, de
 * antes de que "Registro de embolse" existiera en la app. Solo lectura. */
export function useEmbolseHistorico(finca: string | null) {
  const clave = `${CLAVE_CACHE_BASE}_${finca ?? ''}`
  const [filas, setFilas] = useState<EmbolseHistorico[]>(() => leerCacheLocal<EmbolseHistorico[]>(clave) ?? [])
  const [loading, setLoading] = useState(() => !!finca && leerCacheLocal<EmbolseHistorico[]>(clave) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setFilas([])
      setLoading(false)
      return
    }
    const { data, error } = await conCacheLocal<EmbolseHistorico[]>(clave, () =>
      supabase.from('escalera_embolse_historico').select('*').eq('finca', finca).order('anio').order('semana'),
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
    const cacheado = leerCacheLocal<EmbolseHistorico[]>(clave)
    setLoading(!!finca && cacheado === null)
    if (cacheado !== null) setFilas(cacheado)
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { filas, loading, error, refetch }
}

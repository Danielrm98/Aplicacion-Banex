import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { TransporteUnidad } from '../types/transporteUnidad'

function claveCache(fecha: string): string {
  return `approban_cache_transporte_${fecha}`
}

/** Todas las unidades de transporte planificadas/registradas para una fecha,
 * sin filtrar por finca: RLS ya limita lo que cada rol puede ver (todas las
 * fincas para admin, solo las propias para operario/admin_lectura), así que
 * una sola consulta sirve tanto para la tabla-plan del administrador (todas
 * las fincas de un vistazo) como para la vista de una finca puntual —
 * quien la use filtra `filas` por finca si lo necesita. */
export function useTransporteDia(fecha: string) {
  const [filas, setFilas] = useState<TransporteUnidad[]>(() => leerCacheLocal<TransporteUnidad[]>(claveCache(fecha)) ?? [])
  const [loading, setLoading] = useState(() => leerCacheLocal<TransporteUnidad[]>(claveCache(fecha)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<TransporteUnidad[]>(claveCache(fecha), () =>
      supabase.from('transporte_unidades').select('*').eq('fecha', fecha).order('finca').order('numero_unidad'),
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setFilas(data ?? [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  useEffect(() => {
    const cacheado = leerCacheLocal<TransporteUnidad[]>(claveCache(fecha))
    if (cacheado !== null) {
      setFilas(cacheado)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { filas, loading, error, refetch }
}

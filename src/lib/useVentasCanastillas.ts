import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { VentaCanastilla } from '../types/ventaCanastilla'

export interface FiltrosVentasCanastillas {
  finca?: string
  semana?: number
  fecha?: string
}

const CLAVE_CACHE_BASE = 'approban_cache_ventas_canastillas'

function claveCache(filtros: FiltrosVentasCanastillas): string {
  return `${CLAVE_CACHE_BASE}_${JSON.stringify(filtros)}`
}

export function useVentasCanastillas(filtros: FiltrosVentasCanastillas) {
  const [ventas, setVentas] = useState<VentaCanastilla[]>(() => leerCacheLocal<VentaCanastilla[]>(claveCache(filtros)) ?? [])
  const [loading, setLoading] = useState(() => leerCacheLocal<VentaCanastilla[]>(claveCache(filtros)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<VentaCanastilla[]>(claveCache(filtros), () => {
      let query = supabase
        .from('ventas_canastillas')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      if (filtros.finca) query = query.eq('finca', filtros.finca)
      if (filtros.semana) query = query.eq('semana', filtros.semana)
      if (filtros.fecha) query = query.eq('fecha', filtros.fecha)

      return query
    })

    if (error) {
      setError(error)
    } else {
      setError(null)
      setVentas(data ?? [])
    }
    setLoading(false)
    // Por campo, no el objeto filtros completo: ExportButtons/VentaCanastillasPage
    // pasan un literal nuevo en cada render, y depender del objeto entero
    // recrearía refetch sin parar (tanda infinita de peticiones).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.finca, filtros.semana, filtros.fecha])

  useEffect(() => {
    const cacheado = leerCacheLocal<VentaCanastilla[]>(claveCache(filtros))
    if (cacheado !== null) {
      setVentas(cacheado)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { ventas, loading, error, refetch }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { VentaCanastilla } from '../types/ventaCanastilla'

export interface FiltrosVentasCanastillas {
  finca?: string
  semana?: number
  fecha?: string
}

export function useVentasCanastillas(filtros: FiltrosVentasCanastillas) {
  const [ventas, setVentas] = useState<VentaCanastilla[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('ventas_canastillas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (filtros.finca) query = query.eq('finca', filtros.finca)
    if (filtros.semana) query = query.eq('semana', filtros.semana)
    if (filtros.fecha) query = query.eq('fecha', filtros.fecha)

    const { data, error } = await query

    if (error) {
      setError(error.message)
      setVentas([])
    } else {
      setVentas(data ?? [])
    }
    setLoading(false)
  }, [filtros.finca, filtros.semana, filtros.fecha])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ventas, loading, error, refetch }
}

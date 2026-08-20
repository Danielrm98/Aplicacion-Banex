import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Produccion } from '../types/produccion'

export interface Filtros {
  semana?: number
  fecha?: string
  finca?: string
}

export function useProducciones(filtros: Filtros) {
  const [registros, setRegistros] = useState<Produccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('producciones')
      .select('*, items:produccion_items(*), transportes(*)')
      .order('fecha', { ascending: false })

    if (filtros.semana) query = query.eq('semana', filtros.semana)
    if (filtros.fecha) query = query.eq('fecha', filtros.fecha)
    if (filtros.finca) query = query.eq('finca', filtros.finca)

    const { data, error } = await query

    if (error) {
      setError(error.message)
      setRegistros([])
    } else {
      setRegistros(data ?? [])
    }
    setLoading(false)
  }, [filtros.semana, filtros.fecha, filtros.finca])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { registros, loading, error, refetch }
}

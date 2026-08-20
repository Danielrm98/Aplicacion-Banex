import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { PlanSemana } from '../types/plan'

interface Criterio {
  finca: string
  semana: number
  anio: number
}

export function usePlan({ finca, semana, anio }: Criterio) {
  const [plan, setPlan] = useState<PlanSemana | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setPlan(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('planes_semana')
      .select('*, items:plan_items(*)')
      .eq('finca', finca)
      .eq('semana', semana)
      .eq('anio', anio)
      .maybeSingle()

    if (error) {
      setError(error.message)
      setPlan(null)
    } else {
      setPlan(data ?? null)
    }
    setLoading(false)
  }, [finca, semana, anio])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { plan, loading, error, refetch }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import type { PerfilRacimoEvaluacion } from '../types/perfilRacimo'

const TAMANO_PAGINA = 1000
const LIMITE_MS = 15000

/** Trae TODAS las evaluaciones (con sus muestras y defectos) de una finca en
 * un año — a diferencia de usePerfilesRacimo, que solo trae las 60 más
 * recientes para el formulario. Se pagina y se ordena por id (sin orden
 * fijo, Postgres no garantiza qué filas caen en cada página de 1000). */
async function traerTodasLasEvaluaciones(finca: string, anio: number): Promise<PerfilRacimoEvaluacion[]> {
  const todas: PerfilRacimoEvaluacion[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('perfil_racimo_evaluaciones')
      .select('*, muestras:perfil_racimo_muestras(*), defectos:perfil_racimo_defectos(*)')
      .eq('finca', finca)
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`)
      .order('id')
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todas.push(...((data as PerfilRacimoEvaluacion[]) ?? []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return todas
}

export function useResumenPerfilRacimo(finca: string | null, anio: number) {
  const [evaluaciones, setEvaluaciones] = useState<PerfilRacimoEvaluacion[]>([])
  const [loading, setLoading] = useState(() => !!finca)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setEvaluaciones([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await conLimite(traerTodasLasEvaluaciones(finca, anio), LIMITE_MS)
      setEvaluaciones(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }, [finca, anio])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { evaluaciones, loading, error, refetch }
}

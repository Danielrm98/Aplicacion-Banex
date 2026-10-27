import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import type { EvaluacionBanda } from '../types/evaluacionBanda'

const LIMITE_MS = 8000

/** Todo el historial de evaluaciones de banda de una finca (con sus items),
 * del más reciente al más antiguo — igual que useLluviaReportada: se trae
 * de una vez para poder reabrir cualquier fecha anterior sin otra consulta. */
export function useEvaluacionesBanda(finca: string | null) {
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionBanda[]>([])
  const [loading, setLoading] = useState(() => !!finca)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setEvaluaciones([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await conLimite(
      supabase
        .from('evaluaciones_banda')
        .select('*, items:evaluacion_banda_items(*)')
        .eq('finca', finca)
        .order('fecha', { ascending: false })
        .limit(60),
      LIMITE_MS,
    )
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setEvaluaciones((data as EvaluacionBanda[]) ?? [])
    }
    setLoading(false)
  }, [finca])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { evaluaciones, loading, error, refetch }
}

/** Guarda (crea o corrige) la evaluación completa de una finca/fecha: la
 * cabecera con la merma real de finca, y toda la cuadrícula de defectos de
 * una vez (se reemplazan los items existentes, en vez de ir celda por
 * celda, porque el formulario se llena y se envía completo). */
export async function guardarEvaluacionBanda(params: {
  idExistente: string | null
  finca: string
  fecha: string
  semana: number
  mermaFinca: number | null
  items: { grupo: string; defecto: string; cantidad: number }[]
}): Promise<string> {
  const {
    data: { user },
  } = await conLimite(supabase.auth.getUser(), LIMITE_MS)
  if (!user) throw new Error('No hay sesión activa.')

  let evaluacionId = params.idExistente

  if (evaluacionId) {
    const { error } = await conLimite(
      supabase
        .from('evaluaciones_banda')
        .update({ semana: params.semana, merma_finca: params.mermaFinca })
        .eq('id', evaluacionId),
      LIMITE_MS,
    )
    if (error) throw error
  } else {
    const { data, error } = await conLimite(
      supabase
        .from('evaluaciones_banda')
        .insert({
          finca: params.finca,
          fecha: params.fecha,
          semana: params.semana,
          merma_finca: params.mermaFinca,
          user_id: user.id,
        })
        .select('id')
        .single(),
      LIMITE_MS,
    )
    if (error) throw error
    evaluacionId = data.id
  }
  if (!evaluacionId) throw new Error('No se pudo determinar el id de la evaluación.')

  const { error: deleteError } = await conLimite(
    supabase.from('evaluacion_banda_items').delete().eq('evaluacion_id', evaluacionId),
    LIMITE_MS,
  )
  if (deleteError) throw deleteError

  const itemsConCantidad = params.items.filter((it) => it.cantidad > 0)
  if (itemsConCantidad.length > 0) {
    const { error: insertError } = await conLimite(
      supabase.from('evaluacion_banda_items').insert(
        itemsConCantidad.map((it) => ({
          evaluacion_id: evaluacionId,
          grupo: it.grupo,
          defecto: it.defecto,
          cantidad: it.cantidad,
        })),
      ),
      LIMITE_MS,
    )
    if (insertError) throw insertError
  }

  return evaluacionId
}

export async function eliminarEvaluacionBanda(id: string): Promise<void> {
  const { error } = await conLimite(supabase.from('evaluaciones_banda').delete().eq('id', id), LIMITE_MS)
  if (error) throw error
}

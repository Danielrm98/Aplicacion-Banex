import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { fechaLocalHoy } from './fechaLocal'
import type { EvaluacionBanda } from '../types/evaluacionBanda'

const LIMITE_MS = 8000

/** Evaluaciones de banda de una finca que todavía no se han purgado (con
 * sus items), de la más reciente a la más antigua. No es un historial: al
 * guardar una evaluación nueva se borra lo de días anteriores de esa
 * finca, así que normalmente esto solo trae las del día en curso. */
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
        .order('created_at', { ascending: false })
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

/** Guarda (crea o corrige) una evaluación completa: la cabecera con la
 * merma real de finca, y toda la cuadrícula de defectos de una vez (se
 * reemplazan los items existentes, en vez de ir celda por celda, porque el
 * formulario se llena y se envía completo). Una finca puede tener varias
 * evaluaciones el mismo día (no es un upsert por fecha) — cada guardado de
 * una nueva evaluación de paso purga, de esa misma finca, lo que haya
 * quedado de días anteriores: esto es solo informativo para el día en
 * curso, no un historial que haya que conservar. */
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

  try {
    await conLimite(
      supabase.from('evaluaciones_banda').delete().eq('finca', params.finca).lt('fecha', fechaLocalHoy()),
      LIMITE_MS,
    )
  } catch {
    // Purga de días anteriores: es solo housekeeping, no debe bloquear el
    // guardado de la evaluación de hoy si falla.
  }

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

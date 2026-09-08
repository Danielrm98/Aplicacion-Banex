import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import type { Perfil } from '../types/perfil'

export function usePerfil() {
  const { session } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [fincas, setFincas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!session) {
      setPerfil(null)
      setFincas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [perfilRes, fincasRes] = await Promise.all([
      supabase.from('perfiles').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('perfil_fincas').select('finca').eq('user_id', session.user.id),
    ])
    const perfilData = perfilRes.data ?? null
    setPerfil(perfilData)
    const fincasAsignadas = (fincasRes.data ?? []).map((r) => r.finca)
    // Respaldo mientras no se haya corrido la migración de perfil_fincas (o
    // para un usuario que aún no se migró): sigue funcionando con la única
    // finca antigua en vez de dejarlo sin ninguna.
    setFincas(fincasAsignadas.length > 0 ? fincasAsignadas : perfilData?.finca ? [perfilData.finca] : [])
    setLoading(false)
  }, [session])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfil, fincas, loading, refetch }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import type { Perfil } from '../types/perfil'

export function usePerfil() {
  const { session } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!session) {
      setPerfil(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*').eq('user_id', session.user.id).maybeSingle()
    setPerfil(data ?? null)
    setLoading(false)
  }, [session])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfil, loading, refetch }
}

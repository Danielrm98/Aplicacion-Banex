import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { PerfilConFincas } from '../types/perfil'

export function usePerfiles() {
  const [perfiles, setPerfiles] = useState<PerfilConFincas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const [perfilesRes, fincasRes] = await Promise.all([
      supabase.from('perfiles').select('*').order('usuario'),
      supabase.from('perfil_fincas').select('user_id, finca'),
    ])

    if (perfilesRes.error) {
      setError(perfilesRes.error.message)
    } else {
      setError(null)
      const fincasPorUsuario = new Map<string, string[]>()
      // Si perfil_fincas todavía no existe (falta correr la migración) esta
      // consulta falla; se sigue mostrando la lista igual, usando el
      // respaldo de perfiles.finca de cada fila más abajo.
      for (const r of fincasRes.data ?? []) {
        const arr = fincasPorUsuario.get(r.user_id) ?? []
        arr.push(r.finca)
        fincasPorUsuario.set(r.user_id, arr)
      }
      setPerfiles(
        (perfilesRes.data ?? []).map((p) => {
          const asignadas = fincasPorUsuario.get(p.user_id) ?? []
          return { ...p, fincas: asignadas.length > 0 ? asignadas : p.finca ? [p.finca] : [] }
        }),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfiles, loading, error, refetch }
}

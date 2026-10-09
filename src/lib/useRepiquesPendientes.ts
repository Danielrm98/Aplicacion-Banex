import { useCallback, useEffect, useState } from 'react'
import { leerColaRepiques, type RepiquePendiente } from './colaRepiques'

export function useRepiquesPendientes() {
  const [pendientes, setPendientes] = useState<RepiquePendiente[]>([])
  const [cargado, setCargado] = useState(false)

  const recargar = useCallback(async () => {
    setPendientes(await leerColaRepiques())
    setCargado(true)
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { pendientes, cargado, recargar }
}

import { useEffect, useRef, useState } from 'react'
import { leerCola, sincronizarCola } from './colaRegistros'

export function useColaSincronizacion() {
  const [pendientes, setPendientes] = useState(() => leerCola().length)
  const [sincronizando, setSincronizando] = useState(false)
  const enCursoRef = useRef(false)

  async function sincronizarAhora() {
    if (enCursoRef.current) return
    enCursoRef.current = true
    setSincronizando(true)
    try {
      await sincronizarCola()
    } catch {
      // sincronizarCola ya maneja sus propios errores por registro; esto
      // solo cubre un fallo inesperado para no dejar el spinner colgado.
    }
    setPendientes(leerCola().length)
    setSincronizando(false)
    enCursoRef.current = false
  }

  useEffect(() => {
    setPendientes(leerCola().length)
    if (navigator.onLine) sincronizarAhora()

    window.addEventListener('online', sincronizarAhora)
    // La señal en finca es intermitente y el evento "online" del navegador no
    // siempre llega (por ejemplo si la pestaña estaba en segundo plano). Este
    // intervalo reintenta la sincronización aunque ese evento se pierda.
    const intervalo = setInterval(() => {
      if (navigator.onLine && leerCola().length > 0) sincronizarAhora()
      else setPendientes(leerCola().length)
    }, 15000)
    return () => {
      window.removeEventListener('online', sincronizarAhora)
      clearInterval(intervalo)
    }
    // Se registra una sola vez al montar; sincronizarAhora no depende de
    // props ni de estado que cambie entre renders.
  }, [])

  return { pendientes, sincronizando, sincronizarAhora }
}

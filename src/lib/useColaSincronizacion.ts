import { useEffect, useRef, useState } from 'react'
import { leerCola, sincronizarCola } from './colaRegistros'
import { leerColaVentas, sincronizarColaVentas } from './colaCanastillas'

async function contarPendientes(): Promise<number> {
  return leerCola().length + (await leerColaVentas()).length
}

export function useColaSincronizacion() {
  const [pendientes, setPendientes] = useState(() => leerCola().length)
  const [sincronizando, setSincronizando] = useState(false)
  const enCursoRef = useRef(false)

  async function sincronizarAhora() {
    if (enCursoRef.current) return
    enCursoRef.current = true
    setSincronizando(true)
    try {
      await Promise.all([sincronizarCola(), sincronizarColaVentas()])
    } catch {
      // cada cola ya maneja sus propios errores por elemento; esto solo
      // cubre un fallo inesperado para no dejar el spinner colgado.
    }
    setPendientes(await contarPendientes())
    setSincronizando(false)
    enCursoRef.current = false
  }

  useEffect(() => {
    contarPendientes().then(setPendientes)
    if (navigator.onLine) sincronizarAhora()

    window.addEventListener('online', sincronizarAhora)
    // La señal en finca es intermitente y el evento "online" del navegador no
    // siempre llega (por ejemplo si la pestaña estaba en segundo plano). Este
    // intervalo reintenta la sincronización aunque ese evento se pierda.
    const intervalo = setInterval(() => {
      if (navigator.onLine) sincronizarAhora()
      else contarPendientes().then(setPendientes)
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

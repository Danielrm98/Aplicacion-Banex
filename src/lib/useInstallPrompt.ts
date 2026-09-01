import { useEffect, useState } from 'react'

const CLAVE_DESCARTADO = 'approban_instalar_descartado'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type TipoAyudaInstalacion = 'prompt' | 'manual-android' | 'manual-ios' | null

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [tipo, setTipo] = useState<TipoAyudaInstalacion>(null)
  const [descartado, setDescartado] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_DESCARTADO) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const yaInstalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (yaInstalada || descartado) return

    const ua = navigator.userAgent
    const esIOS = /iphone|ipad|ipod/i.test(ua)
    const esAndroid = /android/i.test(ua)

    if (esIOS) {
      setTipo('manual-ios')
      return
    }

    if (!esAndroid) return

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTipo('prompt')
    }

    function onAppInstalled() {
      setTipo(null)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    // Si en unos segundos el navegador no ofrece el aviso nativo de
    // instalación (por ejemplo, el enlace se abrió dentro de WhatsApp, cuyo
    // navegador interno no lo soporta), mostramos instrucciones manuales.
    const timeout = setTimeout(() => {
      setTipo((actual) => actual ?? 'manual-android')
    }, 2500)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      clearTimeout(timeout)
    }
  }, [descartado])

  async function instalar() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setTipo(null)
  }

  function descartar() {
    setDescartado(true)
    setTipo(null)
    try {
      localStorage.setItem(CLAVE_DESCARTADO, 'true')
    } catch {
      // localStorage puede fallar en modo privado; no es crítico para esto.
    }
  }

  return { tipo, instalar, descartar }
}

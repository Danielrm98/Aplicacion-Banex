import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Revisa si hay una versión nueva mientras la app sigue abierta, en vez de
// depender solo de que el navegador la detecte solo en el próximo arranque
// (que a veces tarda o no pasa, dejando la app en blanco tras un despliegue).
// Esto es un respaldo por si la app se queda abierta mucho tiempo sin pasar
// a segundo plano; en el celular, lo que realmente dispara la revisión casi
// siempre es el chequeo inmediato al registrar y el de "volver a primer
// plano" (ver abajo), porque ahí es cuando se entra a la app de nuevo.
const INTERVALO_REVISION_MS = 15 * 60 * 1000

export default function UpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      registrationRef.current = registration
      // Revisión inmediata (no esperar al primer intervalo), reintentada
      // unas cuantas veces en los primeros segundos: en el celular, justo
      // al abrir la app la red/CPU puede seguir "despertando" y una sola
      // revisión muy temprana a veces no alcanza a completarse a tiempo.
      // Luego, cada INTERVALO_REVISION_MS como respaldo.
      for (const espera of [0, 3000, 8000, 15000]) {
        setTimeout(() => registration.update(), espera)
      }
      setInterval(() => registration.update(), INTERVALO_REVISION_MS)
    },
  })

  useEffect(() => {
    // En el celular, lo normal es que la app estuviera en segundo plano (o
    // recién se vuelve a abrir desde el ícono) y no que quede minutos con la
    // pantalla activa; por eso se revisa apenas la pestaña/app vuelve a
    // primer plano, en vez de solo confiar en el intervalo periódico.
    // "pageshow" cubre además el caso de que el navegador restaure la
    // página desde su caché (bfcache) en vez de recargarla de verdad, algo
    // más común en celular que en PC y que "focus" solo no siempre detecta.
    function revisar() {
      registrationRef.current?.update()
    }
    function alVolverAVerse() {
      if (document.visibilityState === 'visible') revisar()
    }
    document.addEventListener('visibilitychange', alVolverAVerse)
    window.addEventListener('focus', revisar)
    window.addEventListener('pageshow', revisar)
    window.addEventListener('online', revisar)
    return () => {
      document.removeEventListener('visibilitychange', alVolverAVerse)
      window.removeEventListener('focus', revisar)
      window.removeEventListener('pageshow', revisar)
      window.removeEventListener('online', revisar)
    }
  }, [])

  if (!needRefresh) return null

  function actualizarAhora() {
    updateServiceWorker(true)
    // Respaldo: en algunos navegadores (sobre todo Safari/iOS en modo
    // "agregado a inicio") el evento que debería recargar la página solo
    // tras activarse la versión nueva a veces no llega; si en unos segundos
    // seguimos aquí, se fuerza la recarga para no dejar al usuario con la
    // sensación de que "no pasó nada" al tocar el botón.
    setTimeout(() => window.location.reload(), 4000)
  }

  return (
    <div className="border-b border-banex-800 bg-banex-900 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">Hay una versión nueva de ApproBan.</span>{' '}
          <span className="text-banex-100">Actualiza para evitar ver la pantalla en blanco.</span>
        </p>
        <button
          onClick={actualizarAhora}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-banex-800 shadow-sm hover:bg-banex-50"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}

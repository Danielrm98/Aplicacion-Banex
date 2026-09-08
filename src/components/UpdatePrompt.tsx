import { useRegisterSW } from 'virtual:pwa-register/react'

// Revisa si hay una versión nueva mientras la app sigue abierta, en vez de
// depender solo de que el navegador la detecte solo en el próximo arranque
// (que a veces tarda o no pasa, dejando la app en blanco tras un despliegue).
const INTERVALO_REVISION_MS = 30 * 60 * 1000

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => registration.update(), INTERVALO_REVISION_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="border-b border-banex-800 bg-banex-900 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">Hay una versión nueva de ApproBan.</span>{' '}
          <span className="text-banex-100">Actualiza para evitar ver la pantalla en blanco.</span>
        </p>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-banex-800 shadow-sm hover:bg-banex-50"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}

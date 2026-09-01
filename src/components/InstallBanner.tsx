import { useInstallPrompt } from '../lib/useInstallPrompt'

export default function InstallBanner() {
  const { tipo, instalar, descartar } = useInstallPrompt()

  if (!tipo) return null

  return (
    <div className="border-b border-banex-800 bg-banex-900 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-2xl items-start gap-3">
        <span className="text-xl leading-none">📲</span>
        <div className="flex-1 text-sm">
          {tipo === 'prompt' && (
            <>
              <p className="font-medium">Instala ApproBan en tu celular</p>
              <p className="text-banex-100">
                Así la abres directo desde tu pantalla de inicio, sin buscarla en el navegador.
              </p>
            </>
          )}
          {tipo === 'manual-android' && (
            <>
              <p className="font-medium">Instala ApproBan en tu celular</p>
              <p className="text-banex-100">
                Si abriste este enlace desde WhatsApp, toca los tres puntos (⋮) arriba a la derecha y elige "Abrir
                en Chrome". Ya en Chrome, toca ⋮ de nuevo y elige "Instalar aplicación".
              </p>
            </>
          )}
          {tipo === 'manual-ios' && (
            <>
              <p className="font-medium">Instala ApproBan en tu iPhone</p>
              <p className="text-banex-100">
                Toca el botón de Compartir (el cuadro con la flecha hacia arriba) y elige "Agregar a pantalla de
                inicio".
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {tipo === 'prompt' && (
            <button
              onClick={instalar}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-banex-800 shadow-sm hover:bg-banex-50"
            >
              Instalar
            </button>
          )}
          <button
            onClick={descartar}
            className="text-xs text-banex-200 underline underline-offset-2 hover:text-white"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}

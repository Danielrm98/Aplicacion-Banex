// Comparte un archivo (la imagen de la factura) usando el selector nativo
// del sistema (navigator.share), que en celular incluye WhatsApp entre las
// opciones. Solo funciona en navegador móvil con HTTPS; en escritorio, o si
// el navegador no lo soporta, se descarga el archivo para adjuntarlo a mano.
export async function compartirOdescargarArchivo(
  file: File,
  opciones: { titulo?: string; texto?: string } = {},
): Promise<'compartido' | 'cancelado' | 'descargado'> {
  const navigatorConShare = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (navigatorConShare.canShare?.({ files: [file] }) && navigatorConShare.share) {
    try {
      await navigatorConShare.share({ files: [file], title: opciones.titulo, text: opciones.texto })
      return 'compartido'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelado'
      // Si share() falla por otra razón, se cae al respaldo de descarga.
    }
  }

  descargarArchivo(file)
  return 'descargado'
}

export function descargarArchivo(file: File) {
  const url = URL.createObjectURL(file)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = file.name
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

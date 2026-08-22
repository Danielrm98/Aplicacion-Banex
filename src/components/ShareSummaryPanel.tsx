import { useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'
import banexLogo from '../assets/banex-logo.jpg'
import { mensajeWhatsapp, type RegistroResumenCompartir } from '../lib/shareSummary'

export default function ShareSummaryPanel({
  resumen,
  onClose,
}: {
  resumen: RegistroResumenCompartir
  onClose: () => void
}) {
  const capturaRef = useRef<HTMLDivElement>(null)
  const [generandoImagen, setGenerandoImagen] = useState(false)
  const [imagenError, setImagenError] = useState<string | null>(null)

  const mensaje = mensajeWhatsapp(resumen)

  function compartirWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  async function compartirImagen() {
    if (!capturaRef.current) return
    setImagenError(null)
    setGenerandoImagen(true)
    try {
      const blob = await domToBlob(capturaRef.current, { backgroundColor: '#ffffff', scale: 2 })

      const nombreArchivo = `registro_${resumen.finca}_${resumen.fecha}.png`.replace(/\s+/g, '_')
      const file = new File([blob], nombreArchivo, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Registro ApproBan', text: mensaje })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = nombreArchivo
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // el usuario canceló el cuadro de compartir, no es un error real
      } else {
        setImagenError(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
      }
    } finally {
      setGenerandoImagen(false)
    }
  }

  const racimosConDato = resumen.racimosPorEdad.filter((e) => e.racimos > 0 || e.grado !== null)

  return (
    <div className="rounded-xl border border-banex-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="text-sm font-semibold text-banex-800">Registro guardado — comparte el resumen</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          Cerrar ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
        <div ref={capturaRef} className="w-full max-w-[420px] rounded-lg border border-gray-100 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3">
            <img src={banexLogo} alt="BANEX S.A." className="h-9 w-9 shrink-0 rounded-md object-contain" />
            <div>
              <p className="text-sm font-bold text-banex-900">ApproBan</p>
              <p className="text-xs text-gray-500">Registro de producción</p>
            </div>
          </div>

          <div className="mb-3 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-900">{resumen.fecha}</span>{' '}
              <span className="text-gray-500">· Semana {resumen.semana}</span>
            </p>
            <p className="font-medium text-banex-800">{resumen.finca}</p>
            {resumen.horaFinalizacion && <p className="text-xs text-gray-500">Hora finalización: {resumen.horaFinalizacion}</p>}
          </div>

          {(resumen.areaRecorrida !== null || resumen.porcentajeSemana !== null) && (
            <div className="mb-3 text-xs text-gray-600">
              <p className="mb-1 font-semibold text-banex-700">Área recorrida</p>
              {resumen.areaRecorrida !== null && (
                <p>
                  Hoy: {resumen.areaRecorrida} ha
                  {resumen.porcentajeDia !== null && ` (${resumen.porcentajeDia.toFixed(1)}%)`}
                </p>
              )}
              {resumen.porcentajeSemana !== null && <p>Acumulado semana: {resumen.porcentajeSemana.toFixed(1)}%</p>}
            </div>
          )}

          <div className="mb-3 text-xs text-gray-600">
            <p className="mb-1 font-semibold text-banex-700">Racimos por edad</p>
            {racimosConDato.length > 0 ? (
              <p>
                {racimosConDato
                  .map((e) => `S${e.semana}: ${e.racimos}${e.grado !== null ? ` (grado ${e.grado})` : ''}`)
                  .join(' · ')}
              </p>
            ) : (
              <p>—</p>
            )}
            <p className="mt-1">
              Cosechados: <span className="font-medium text-gray-900">{resumen.totalRacimos}</span> · Recusados:{' '}
              {resumen.racimosRecusados} · Procesados: {resumen.totalRacimosProcesados}
            </p>
          </div>

          <div className="mb-3 text-xs text-gray-600">
            <p className="mb-1 font-semibold text-banex-700">Referencias producidas</p>
            {resumen.referencias.map((it, i) => (
              <p key={i}>
                {it.referencia}: {it.cajas} cajas
                {it.cajas20kg !== null && ` (${it.cajas20kg.toFixed(2)} cajas 20kg)`}
                {it.rechazadas > 0 && ` · ${it.rechazadas} rechazadas`}
              </p>
            ))}
          </div>

          <div className="mb-3 text-xs text-gray-600">
            <p className="mb-1 font-semibold text-banex-700">Totales</p>
            <p>
              Cajas: <span className="font-medium text-gray-900">{resumen.totalCajas}</span> · Cajas 20kg:{' '}
              {resumen.totalCajas20kg.toFixed(2)} · Canastillas: {resumen.canastillas} ({resumen.kilosCanastillas.toFixed(2)} kg)
            </p>
            <p>
              {resumen.pesoNetoRacimo !== null && `Peso neto racimo: ${resumen.pesoNetoRacimo.toFixed(2)} kg · `}
              {resumen.ratio !== null && `Ratio: ${resumen.ratio.toFixed(2)} · `}
              {resumen.merma !== null && `Merma: ${resumen.merma.toFixed(1)}%`}
            </p>
          </div>

          {resumen.transportes.length > 0 && (
            <div className="mb-3 text-xs text-gray-600">
              <p className="mb-1 font-semibold text-banex-700">Transporte</p>
              {resumen.transportes.map((t, i) => (
                <p key={i}>
                  {[t.tipo, t.placa, t.sello, t.horaLlegada && t.horaSalida ? `${t.horaLlegada}-${t.horaSalida}` : t.horaLlegada]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ))}
            </div>
          )}

          {resumen.notas && (
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-banex-700">Notas: </span>
              {resumen.notas}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-56">
          <button
            onClick={compartirWhatsapp}
            className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1fb959]"
          >
            Compartir por WhatsApp
          </button>
          <button
            onClick={compartirImagen}
            disabled={generandoImagen}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700 disabled:opacity-50"
          >
            {generandoImagen ? 'Generando imagen...' : 'Compartir como imagen'}
          </button>
          {imagenError && <p className="text-xs text-red-600">{imagenError}</p>}
          <p className="mt-1 text-xs text-gray-400">
            "Compartir como imagen" abre el panel para enviar por WhatsApp en el celular; en computador la descarga como PNG.
          </p>
        </div>
      </div>
    </div>
  )
}

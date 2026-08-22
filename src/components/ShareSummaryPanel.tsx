import { useRef, useState, type ReactNode } from 'react'
import { domToBlob } from 'modern-screenshot'
import banexLogo from '../assets/banex-logo.jpg'
import { mensajeWhatsapp, type RegistroResumenCompartir } from '../lib/shareSummary'
import { diaSemana } from '../lib/diaSemana'

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
  const tieneArea = resumen.areaRecorrida !== null

  return (
    <div className="rounded-xl border border-banex-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="text-sm font-semibold text-banex-800">Comparte el resumen del registro</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          Cerrar ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
        <div ref={capturaRef} className="w-full max-w-[840px] rounded-lg border border-gray-100 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <img src={banexLogo} alt="BANEX S.A." className="h-9 w-9 shrink-0 rounded-md object-contain" />
            <div>
              <p className="text-sm font-bold text-banex-900">ApproBan</p>
              <p className="text-xs text-gray-500">Registro de producción</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Casilla label="Finca" valor={resumen.finca} destacado />
                <Casilla label="Semana" valor={resumen.semana} />
                <Casilla label="Fecha" valor={resumen.fecha} subvalor={diaSemana(resumen.fecha)} />
                <Casilla label="Hora finalización" valor={resumen.horaFinalizacion || '—'} />
              </div>

              {tieneArea && (
                <CasillaSeccion titulo="Área recorrida">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Casilla label="Área total" valor={resumen.areaTotal !== null ? `${resumen.areaTotal} ha` : '—'} />
                    <Casilla label="Recorrida hoy" valor={resumen.areaRecorrida !== null ? `${resumen.areaRecorrida} ha` : '—'} />
                    <Casilla label="% del día" valor={resumen.porcentajeDia !== null ? `${resumen.porcentajeDia.toFixed(1)}%` : '—'} />
                  </div>
                </CasillaSeccion>
              )}

              <CasillaSeccion titulo="Racimos por edad">
                {racimosConDato.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {racimosConDato.map((e) => (
                      <Casilla
                        key={e.semana}
                        label={`Semana ${e.semana}`}
                        valor={e.racimos}
                        subvalor={e.grado !== null ? `grado ${e.grado}` : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Sin racimos registrados.</p>
                )}
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Casilla label="Cosechados" valor={resumen.totalRacimos} destacado />
                  <Casilla label="Recusados" valor={resumen.racimosRecusados} />
                </div>
              </CasillaSeccion>

              <CasillaSeccion titulo="Canastillas">
                <div className="grid grid-cols-3 gap-1.5">
                  <Casilla label="Cantidad" valor={resumen.canastillas} />
                </div>
              </CasillaSeccion>
            </div>

            <div className="flex flex-col gap-3.5">
              <CasillaSeccion titulo="Referencias producidas">
                <div className="flex flex-col gap-1.5">
                  {resumen.referencias.map((it, i) => (
                    <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-2">
                      <p className="mb-1 text-xs font-semibold text-gray-900">{it.referencia}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Casilla label="Cajas" valor={it.cajas} compacto />
                        <Casilla label="Cajas 20kg" valor={it.cajas20kg !== null ? it.cajas20kg.toFixed(2) : '—'} compacto />
                      </div>
                    </div>
                  ))}
                </div>
              </CasillaSeccion>

              <CasillaSeccion titulo="Totales">
                <div className="grid grid-cols-3 gap-1.5">
                  <Casilla label="Cajas" valor={resumen.totalCajas} destacado />
                  <Casilla label="Cajas 20kg" valor={resumen.totalCajas20kg.toFixed(2)} />
                  <Casilla label="Peso neto racimo" valor={resumen.pesoNetoRacimo !== null ? `${resumen.pesoNetoRacimo.toFixed(2)} kg` : '—'} />
                  <Casilla label="Ratio" valor={resumen.ratio !== null ? resumen.ratio.toFixed(2) : '—'} />
                  <Casilla label="Merma" valor={resumen.merma !== null ? `${resumen.merma.toFixed(1)}%` : '—'} />
                </div>
              </CasillaSeccion>

              {resumen.transportes.length > 0 && (
                <CasillaSeccion titulo="Transporte">
                  <div className="flex flex-col gap-1.5">
                    {resumen.transportes.map((t, i) => (
                      <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          <Casilla label="Tipo" valor={t.tipo || '—'} compacto />
                          <Casilla label="Placa" valor={t.placa || '—'} compacto />
                          <Casilla label="Sello" valor={t.sello || '—'} compacto />
                          <Casilla label="Hora llegada" valor={t.horaLlegada || '—'} compacto />
                          <Casilla label="Hora salida" valor={t.horaSalida || '—'} compacto />
                        </div>
                      </div>
                    ))}
                  </div>
                </CasillaSeccion>
              )}

              {resumen.notas && (
                <CasillaSeccion titulo="Notas">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">{resumen.notas}</div>
                </CasillaSeccion>
              )}
            </div>
          </div>
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

function CasillaSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-banex-600 uppercase">
        <span className="h-3 w-0.5 shrink-0 rounded-full bg-banana-500" />
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Casilla({
  label,
  valor,
  subvalor,
  destacado = false,
  compacto = false,
}: {
  label: string
  valor: ReactNode
  subvalor?: string
  destacado?: boolean
  compacto?: boolean
}) {
  return (
    <div className={`rounded-md border ${destacado ? 'border-banex-200 bg-banex-50' : 'border-gray-200 bg-gray-50'} ${compacto ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
      <p className="truncate text-[10px] font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      <p className={`truncate text-xs font-semibold ${destacado ? 'text-banex-800' : 'text-gray-900'}`}>{valor}</p>
      {subvalor && <p className="truncate text-[10px] text-gray-500">{subvalor}</p>}
    </div>
  )
}

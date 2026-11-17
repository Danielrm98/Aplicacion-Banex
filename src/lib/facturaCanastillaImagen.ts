// Compone la "factura" de canastillas como una imagen PNG dibujada en un
// <canvas> (no es una foto de un papel): datos de la venta + nombre y
// firma de quien entrega y de quien recibe, en formato de comprobante
// (recibo angosto, check verde arriba, separadores punteados). El
// resultado se sube al mismo bucket/columna factura_path que ya usa la
// foto, así que el resto de la app (botón "Ver factura") no necesita saber
// cuál de las dos formas se usó.
//
// El obsequio de canastillas NO entra aquí a propósito: esta factura es el
// comprobante de la venta (proceso + repique), el obsequio es aparte.

const ANCHO = 480
const MARGEN = 32
const ALTO_FIRMA = 120
const COLOR_TITULO = '#0b5f29'
const COLOR_CHECK = '#1e9f4c'
const COLOR_ETIQUETA = '#6b7280'
const COLOR_VALOR = '#111827'
const COLOR_LINEA = '#d1d5db'

function envolverTexto(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number): string[] {
  const palabras = texto.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const intento = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(intento).width > anchoMax && actual) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = intento
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function dibujarCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, radio: number) {
  ctx.beginPath()
  ctx.fillStyle = COLOR_CHECK
  ctx.arc(cx, cy, radio, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - radio * 0.45, cy)
  ctx.lineTo(cx - radio * 0.08, cy + radio * 0.35)
  ctx.lineTo(cx + radio * 0.5, cy - radio * 0.35)
  ctx.stroke()
}

function lineaPunteada(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save()
  ctx.strokeStyle = COLOR_LINEA
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(MARGEN, y)
  ctx.lineTo(ANCHO - MARGEN, y)
  ctx.stroke()
  ctx.restore()
}

export interface DatosFacturaCanastilla {
  finca: string
  fecha: string
  semana: number
  cantidad: number
  cantidadRepique: number
  notas: string | null
  entregadoPor: string
  recibidoPor: string
  firmaEntrega: HTMLCanvasElement | null
  firmaRecibe: HTMLCanvasElement | null
}

/** Dibuja todo el contenido y devuelve el alto final usado (el llamador la
 * corre una vez en un canvas chico solo para medir, y otra vez ya en el
 * canvas del tamaño correcto — así la altura real y la dibujada nunca
 * quedan desincronizadas). */
function dibujarContenido(ctx: CanvasRenderingContext2D, datos: DatosFacturaCanastilla, lineasNotas: string[]): number {
  const cx = ANCHO / 2
  let y = 24

  dibujarCheck(ctx, cx, y + 36, 36)
  y += 88

  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR_TITULO
  ctx.font = 'bold 21px sans-serif'
  ctx.fillText('Comprobante de venta de canastillas', cx, y)
  y += 26

  ctx.font = '13px sans-serif'
  ctx.fillStyle = COLOR_ETIQUETA
  ctx.fillText(datos.finca, cx, y)
  y += 18
  ctx.fillText(`${datos.fecha} · Semana ${datos.semana}`, cx, y)
  y += 32
  ctx.textAlign = 'left'

  lineaPunteada(ctx, y)
  y += 30

  const campo = (etiqueta: string, valor: string, destacado = false) => {
    ctx.font = destacado ? 'bold 17px sans-serif' : '15px sans-serif'
    ctx.fillStyle = destacado ? COLOR_TITULO : COLOR_VALOR
    ctx.fillText(`${etiqueta}: ${valor}`, MARGEN, y)
  }
  campo('Canastillas de proceso', String(datos.cantidad))
  y += 34
  campo('Canastillas de repique', String(datos.cantidadRepique))
  y += 48
  campo('Total facturado', String(datos.cantidad + datos.cantidadRepique), true)
  y += 30

  if (lineasNotas.length > 0) {
    ctx.font = '13px sans-serif'
    ctx.fillStyle = COLOR_ETIQUETA
    ctx.fillText('Notas', MARGEN, y)
    y += 20
    ctx.font = '14px sans-serif'
    ctx.fillStyle = COLOR_VALOR
    for (const linea of lineasNotas) {
      ctx.fillText(linea, MARGEN, y)
      y += 20
    }
    y += 10
  }

  lineaPunteada(ctx, y)
  y += 30

  const seccionFirma = (titulo: string, nombre: string, firma: HTMLCanvasElement | null) => {
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = COLOR_VALOR
    ctx.fillText(titulo, MARGEN, y)
    y += 24
    ctx.font = '15px sans-serif'
    ctx.fillText(`Nombre: ${nombre || '—'}`, MARGEN, y)
    y += 18
    ctx.font = '13px sans-serif'
    ctx.fillStyle = COLOR_ETIQUETA
    ctx.fillText('Firma:', MARGEN, y)
    y += 16
    ctx.strokeStyle = COLOR_LINEA
    ctx.strokeRect(MARGEN, y, ANCHO - MARGEN * 2, ALTO_FIRMA)
    if (firma) ctx.drawImage(firma, MARGEN, y, ANCHO - MARGEN * 2, ALTO_FIRMA)
    y += ALTO_FIRMA + 26
  }
  seccionFirma('¿Quién recibe las canastillas?', datos.recibidoPor, datos.firmaRecibe)
  seccionFirma('¿Quién entrega las canastillas?', datos.entregadoPor, datos.firmaEntrega)

  ctx.font = '11px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(`Generado el ${new Date().toLocaleString('es')}`, MARGEN, y)
  y += 16

  return y
}

export async function generarImagenFacturaCanastilla(datos: DatosFacturaCanastilla): Promise<File> {
  const medidorCanvas = document.createElement('canvas')
  medidorCanvas.width = ANCHO
  medidorCanvas.height = 10
  const medidor = medidorCanvas.getContext('2d')!
  medidor.font = '14px sans-serif'
  const lineasNotas = datos.notas ? envolverTexto(medidor, datos.notas, ANCHO - MARGEN * 2) : []

  const altoNecesario = dibujarContenido(medidor, datos, lineasNotas)

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = altoNecesario + 16
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  dibujarContenido(ctx, datos, lineasNotas)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la imagen de la factura.'))
        return
      }
      resolve(new File([blob], `factura-${datos.fecha}.png`, { type: 'image/png' }))
    }, 'image/png')
  })
}

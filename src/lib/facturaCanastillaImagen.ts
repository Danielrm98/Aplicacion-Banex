// Compone la "factura" de canastillas como una imagen PNG dibujada en un
// <canvas> (no es una foto de un papel): datos de la venta + nombre y
// firma de quien entrega y de quien recibe. El resultado se sube al mismo
// bucket/columna factura_path que ya usa la foto, así que el resto de la
// app (botón "Ver factura") no necesita saber cuál de las dos formas se usó.

const ANCHO = 760
const COLOR_TITULO = '#0b5f29'
const COLOR_ETIQUETA = '#6b7280'
const COLOR_VALOR = '#111827'
const COLOR_LINEA = '#e5e7eb'

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

export interface DatosFacturaCanastilla {
  finca: string
  fecha: string
  semana: number
  cantidad: number
  cantidadRepique: number
  cantidadObsequio: number
  notas: string | null
  entregadoPor: string
  recibidoPor: string
  firmaEntrega: HTMLCanvasElement | null
  firmaRecibe: HTMLCanvasElement | null
}

export async function generarImagenFacturaCanastilla(datos: DatosFacturaCanastilla): Promise<File> {
  // Primero se mide en un canvas temporal para saber cuánto alto necesita
  // (las notas pueden ocupar varias líneas), y luego se dibuja ya en el
  // canvas final con esa altura exacta.
  const medidor = document.createElement('canvas').getContext('2d')!
  medidor.font = '14px sans-serif'
  const anchoTexto = ANCHO - 80
  const lineasNotas = datos.notas ? envolverTexto(medidor, datos.notas, anchoTexto) : []

  let alto = 150 // encabezado
  const campos = [
    datos.cantidad > 0,
    datos.cantidadRepique > 0,
    datos.cantidadObsequio > 0,
    true, // total
  ].filter(Boolean).length
  alto += 40 // "Finca"
  alto += 40 // "Fecha / Semana" (misma fila)
  alto += campos * 44
  if (lineasNotas.length > 0) alto += 30 + lineasNotas.length * 20
  alto += 30 // separador antes de firmas
  alto += 20 + 150 + 35 // etiqueta + recuadro de firma + nombre
  alto += 40 // pie con fecha de generación

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = alto
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO, alto)

  ctx.fillStyle = COLOR_TITULO
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText('BANEX S.A.', 40, 55)
  ctx.fillStyle = COLOR_ETIQUETA
  ctx.font = '15px sans-serif'
  ctx.fillText('Comprobante de entrega de canastillas', 40, 80)

  ctx.strokeStyle = COLOR_LINEA
  ctx.beginPath()
  ctx.moveTo(40, 105)
  ctx.lineTo(ANCHO - 40, 105)
  ctx.stroke()

  let y = 145
  const campo = (etiqueta: string, valor: string, x = 40) => {
    ctx.font = '13px sans-serif'
    ctx.fillStyle = COLOR_ETIQUETA
    ctx.fillText(etiqueta, x, y)
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = COLOR_VALOR
    ctx.fillText(valor, x, y + 22)
  }

  campo('Finca', datos.finca)
  y += 50
  campo('Fecha', datos.fecha, 40)
  campo('Semana', String(datos.semana), 400)
  y += 50

  if (datos.cantidad > 0) {
    campo('Canastillas del proceso', String(datos.cantidad))
    y += 44
  }
  if (datos.cantidadRepique > 0) {
    campo('Canastillas por repique', String(datos.cantidadRepique))
    y += 44
  }
  if (datos.cantidadObsequio > 0) {
    campo('Obsequio (personal)', String(datos.cantidadObsequio))
    y += 44
  }
  campo('Total entregado', String(datos.cantidad + datos.cantidadRepique + datos.cantidadObsequio))
  y += 44

  if (lineasNotas.length > 0) {
    ctx.font = '13px sans-serif'
    ctx.fillStyle = COLOR_ETIQUETA
    ctx.fillText('Notas', 40, y)
    y += 18
    ctx.font = '15px sans-serif'
    ctx.fillStyle = COLOR_VALOR
    for (const linea of lineasNotas) {
      ctx.fillText(linea, 40, y)
      y += 20
    }
    y += 10
  }

  y += 10
  ctx.strokeStyle = COLOR_LINEA
  ctx.beginPath()
  ctx.moveTo(40, y)
  ctx.lineTo(ANCHO - 40, y)
  ctx.stroke()
  y += 35

  const colAncho = (ANCHO - 80 - 40) / 2
  const xEntrega = 40
  const xRecibe = 40 + colAncho + 40
  const altoFirma = 150

  ctx.font = '13px sans-serif'
  ctx.fillStyle = COLOR_ETIQUETA
  ctx.fillText('Entrega', xEntrega, y)
  ctx.fillText('Recibe', xRecibe, y)
  y += 12

  ctx.strokeStyle = '#d1d5db'
  ctx.strokeRect(xEntrega, y, colAncho, altoFirma)
  ctx.strokeRect(xRecibe, y, colAncho, altoFirma)
  if (datos.firmaEntrega) ctx.drawImage(datos.firmaEntrega, xEntrega, y, colAncho, altoFirma)
  if (datos.firmaRecibe) ctx.drawImage(datos.firmaRecibe, xRecibe, y, colAncho, altoFirma)
  y += altoFirma + 22

  ctx.font = 'bold 15px sans-serif'
  ctx.fillStyle = COLOR_VALOR
  ctx.fillText(datos.entregadoPor || '—', xEntrega, y)
  ctx.fillText(datos.recibidoPor || '—', xRecibe, y)

  ctx.font = '11px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(`Generado el ${new Date().toLocaleString('es')}`, 40, alto - 20)

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

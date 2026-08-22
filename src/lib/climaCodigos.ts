export interface DescripcionClima {
  texto: string
  icono: string
}

const CODIGOS_WMO: Record<number, DescripcionClima> = {
  0: { texto: 'Despejado', icono: '☀️' },
  1: { texto: 'Mayormente despejado', icono: '🌤️' },
  2: { texto: 'Parcialmente nublado', icono: '⛅' },
  3: { texto: 'Nublado', icono: '☁️' },
  45: { texto: 'Niebla', icono: '🌫️' },
  48: { texto: 'Niebla con escarcha', icono: '🌫️' },
  51: { texto: 'Llovizna ligera', icono: '🌦️' },
  53: { texto: 'Llovizna', icono: '🌦️' },
  55: { texto: 'Llovizna densa', icono: '🌦️' },
  56: { texto: 'Llovizna helada', icono: '🌦️' },
  57: { texto: 'Llovizna helada densa', icono: '🌦️' },
  61: { texto: 'Lluvia ligera', icono: '🌧️' },
  63: { texto: 'Lluvia', icono: '🌧️' },
  65: { texto: 'Lluvia fuerte', icono: '🌧️' },
  66: { texto: 'Lluvia helada', icono: '🌧️' },
  67: { texto: 'Lluvia helada fuerte', icono: '🌧️' },
  71: { texto: 'Nieve ligera', icono: '🌨️' },
  73: { texto: 'Nieve', icono: '🌨️' },
  75: { texto: 'Nieve fuerte', icono: '🌨️' },
  77: { texto: 'Granizo de nieve', icono: '🌨️' },
  80: { texto: 'Chubascos ligeros', icono: '🌦️' },
  81: { texto: 'Chubascos', icono: '🌧️' },
  82: { texto: 'Chubascos fuertes', icono: '⛈️' },
  85: { texto: 'Chubascos de nieve', icono: '🌨️' },
  86: { texto: 'Chubascos de nieve fuertes', icono: '🌨️' },
  95: { texto: 'Tormenta eléctrica', icono: '⛈️' },
  96: { texto: 'Tormenta con granizo', icono: '⛈️' },
  99: { texto: 'Tormenta fuerte con granizo', icono: '⛈️' },
}

export function descripcionClima(codigo: number): DescripcionClima {
  return CODIGOS_WMO[codigo] ?? { texto: 'Sin datos', icono: '🌡️' }
}

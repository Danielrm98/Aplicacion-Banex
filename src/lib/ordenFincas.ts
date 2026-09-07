// Orden fijo de fincas pedido por el usuario (no alfabético), reutilizado
// donde convenga trabajar las fincas siempre en el mismo orden. Una finca
// que no esté en esta lista se ubica al final, sin romper nada.
export const ORDEN_FINCAS = [
  'TAMACARA',
  'FLORIDA',
  'LAS DELICIAS',
  'DILIA ESTHER',
  'GOLONDRINA NUEVA',
  'GOLONDRINA VIEJA',
  'GLORIA MERCEDES',
  'LUCILA MARINA',
  'ESMERALDA',
  'LA MARIA',
  'TROPICANA',
  'COSTANERA',
  'RAQUELITA',
  'MILADY',
  'MACONDO',
]

export function posicionFinca(finca: string): number {
  const idx = ORDEN_FINCAS.indexOf(finca.toUpperCase())
  return idx === -1 ? ORDEN_FINCAS.length : idx
}

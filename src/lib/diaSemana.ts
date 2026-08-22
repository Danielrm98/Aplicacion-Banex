const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function diaSemana(fechaIso: string): string {
  if (!fechaIso) return ''
  return DIAS_SEMANA[new Date(fechaIso + 'T00:00:00').getDay()]
}

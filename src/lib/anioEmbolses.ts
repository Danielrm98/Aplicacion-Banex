// El "año de embolses" de BANEX no es el año calendario: siempre arranca en
// la semana ISO 42 del año calendario anterior (esos racimos se cosechan ya
// entrado el año siguiente) y se ve hasta la semana 52/53 del año en curso —
// las semanas 42 en adelante de ese año en curso ya pertenecen al siguiente
// año de embolses, pero se siguen registrando dentro de este año calendario,
// así que se muestran aquí también para no tener que cambiar de año a mitad
// de la captura semanal.

function pDeAnio(anio: number): number {
  return (anio + Math.floor(anio / 4) - Math.floor(anio / 100) + Math.floor(anio / 400)) % 7
}

/** 52 o 53, según la regla ISO 8601 de años con semana 53. */
export function semanasIsoEnAnio(anio: number): 52 | 53 {
  return pDeAnio(anio) === 4 || pDeAnio(anio - 1) === 3 ? 53 : 52
}

export interface SemanaReal {
  anio: number
  semana: number
}

/** Lista ordenada de semanas reales (año/semana) que componen un "año de embolses". */
export function semanasDelAnioEmbolses(anioEmbolses: number): SemanaReal[] {
  const semanas: SemanaReal[] = []
  const anioAnterior = anioEmbolses - 1
  for (let s = 42; s <= semanasIsoEnAnio(anioAnterior); s++) semanas.push({ anio: anioAnterior, semana: s })
  for (let s = 1; s <= semanasIsoEnAnio(anioEmbolses); s++) semanas.push({ anio: anioEmbolses, semana: s })
  return semanas
}

/** A qué "año de embolses" pertenece una semana real dada. */
export function anioEmbolsesDe(anio: number, semana: number): number {
  return semana >= 42 ? anio + 1 : anio
}

// Fórmulas de "Perfil de racimos", compartidas entre el formulario en vivo,
// el resumen de evaluaciones guardadas y el resumen por lote — para no
// repetirlas en cada lugar que las necesita.
export interface MuestraValores {
  A: number | null // peso fruta premium
  B: number | null // peso fruta corta
  C: number // peso de merma (suma de defectos, siempre un número)
  D: number | null // vástago y corona
}

export interface ComputoRacimo {
  E: number | null // peso neto de fruta = A+B+C
  F: number | null // peso total de racimo = E+D
  G: number | null // % de merma = C/E*100
  ratioPremio: number | null // A/E
  ratioTotal: number | null // (A+B)/E
  ratioPotencial: number | null // E/F
}

/** E=A+B+C · F=E+D · G(%merma)=C/E*100 · ratio premio=A/E · ratio total=(A+B)/E · ratio potencial=E/F. */
export function computarRacimo({ A, B, C, D }: MuestraValores): ComputoRacimo {
  const E = A === null && B === null && C === 0 ? null : (A ?? 0) + (B ?? 0) + C
  const F = E === null ? null : E + (D ?? 0)
  const G = E !== null && E > 0 ? (C / E) * 100 : null
  const ratioPremio = E !== null && E > 0 && A !== null ? A / E : null
  const ratioTotal = E !== null && E > 0 && A !== null && B !== null ? (A + B) / E : null
  const ratioPotencial = F !== null && F > 0 && E !== null ? E / F : null
  return { E, F, G, ratioPremio, ratioTotal, ratioPotencial }
}

export function promedioDe(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null)
  return validos.length > 0 ? validos.reduce((a, b) => a + b, 0) / validos.length : null
}

export function formatoNum(v: number | null, decimales = 2): string {
  return v === null ? '—' : v.toLocaleString('es', { maximumFractionDigits: decimales })
}

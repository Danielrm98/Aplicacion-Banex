// Catálogo fijo de "Evaluación de banda": mismos grupos y defectos del
// formato en papel que ya usan las fincas. Si algún día cambia la lista,
// se ajusta aquí (no hay pantalla de catálogo para esto, a diferencia de
// Referencias/Fincas, porque es un formato fijo de la compañía).
export const GRUPOS_EVALUACION_BANDA = ['AMBIENTE', 'COSECHA', 'CULTIVO', 'EMPAQUE', 'ENFERMEDAD', 'ANIMAL'] as const

export type GrupoEvaluacionBanda = (typeof GRUPOS_EVALUACION_BANDA)[number]

export const DEFECTOS_POR_GRUPO: Record<GrupoEvaluacionBanda, string[]> = {
  AMBIENTE: [
    'CASCARA RAJADA',
    'CHIMERA',
    'DEDO CORTO',
    'FRUTA POBRE',
    'MAL FORMADO',
    'M. MADUREZ',
    'QUEMA DE SOL (PUDRE)',
    'QUEMA DE SOL (PUNTA AMARILLA)',
    'OXIDO ROJO',
  ],
  COSECHA: [
    'C. FRICCIÓN',
    'C. MANEJO',
    'C. NYLON',
    'CORTE DE CUCHILLO',
    'CUELLO ROTO',
    'DAÑO DE PUNTA',
    'GRASA',
    'LATEX DE COSECHA',
    'MALTRATO',
    'SOBRE GRADO',
  ],
  CULTIVO: ['C. DE CRECIMIENTO', 'C. DE HOJA', 'CORTE VIEJO DE CUCHILLO', 'LATEX DE DESHOJE', 'LATEX DE DESFLORE', 'PEGUETA', 'PEINETA'],
  EMPAQUE: ['CORTE CUCHILLO DESMANE', 'CORTE CUCHILLO SELECCIÓN', 'CUELLO ROTO DESMANE', 'DEDO APROVECHABLE'],
  ENFERMEDAD: ['MOQUILLO', 'PUDRE DE CUELLO', 'PUDRE DE DEDO', 'SPECKLING'],
  ANIMAL: ['COCHINILLA', 'COLASPIS', 'DAÑO ANIMAL', 'HOORMIGA', 'MANCHA ROJA', 'MOSCA GUARERA', 'PIQUETE DE ABEJA'],
}

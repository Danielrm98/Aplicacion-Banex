// Catálogo fijo de "Perfil de racimo y merma": mismos grupos y defectos del
// formato en papel que ya usan las fincas. Si algún día cambia la lista, se
// ajusta aquí (no hay pantalla de catálogo para esto, igual que Evaluación
// de banda, porque es un formato fijo de la compañía).
export const GRUPOS_PERFIL_RACIMO = ['COSECHA', 'CULTIVO', 'EMPACADORA', 'AMBIENTE', 'ANIMAL', 'ENFERMEDAD'] as const

export type GrupoPerfilRacimo = (typeof GRUPOS_PERFIL_RACIMO)[number]

export const DEFECTOS_POR_GRUPO_PERFIL_RACIMO: Record<GrupoPerfilRacimo, string[]> = {
  COSECHA: [
    'MALTRATO',
    'FRICCIÓN POR COSECHA',
    'CUELLO ROTO',
    'LATEX DE COSECHA/GELATINOSO',
    'SOBRE GRADO',
    'BAJO GRADO',
    'CORTE DE CUCHILLO',
    'DAÑO DE PUNTA',
    'GRASA',
    'CICATRIZ DE MANEJO',
  ],
  CULTIVO: [
    'CICATRIZ DE CRECIMIENTO',
    'CICATRIZ DE HOJA',
    'CICATRIZ DE TALLO',
    'PEINETA',
    'FRUTA CURVA',
    'RESIDUO DE FLORES',
    'PUDRE DE CUELLO POR PARCELA',
    'PEGUETA',
    'CORTE VIEJO DE CUCHILLO',
    'LATEX DE DESHOJE',
    'LATEX DE DESFLORE',
  ],
  EMPACADORA: ['CORTE DE CUCHILLO DESMANE', 'CORTE DE CUCHILLO SELECCIÓN', 'CUELLO ROTO DE DESMANE', 'CICATRIZ DE SELECCIÓN', 'DEDO APROVECHABLE'],
  AMBIENTE: [
    'MANCHA DE MADUREZ',
    'MALFORMADOS',
    'OXIDO ROJO',
    'DEDO CORTO',
    'CASCARA RAJADA',
    'CHIMERA',
    'QUEMA DE SOL PUNTA AMARILLA',
    'QUEMA DE SOL - PUDRE',
    'RESIDUO QUIMICO',
  ],
  ANIMAL: ['DAÑO ANIMAL', 'CATERPILLER', 'COCHINILLA', 'MOSCA GUARERA', 'FUMAGINA', 'PIQUETE DE ABEJA/MAPAITERO', 'COLASPIS', 'NIDO DE ARAÑA'],
  ENFERMEDAD: ['TRIPS', 'SPECKLE', 'MOQUILLO'],
}

export const NUMEROS_MUESTRA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

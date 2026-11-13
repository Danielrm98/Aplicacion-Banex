export interface PerfilRacimoMuestra {
  id: string
  evaluacion_id: string
  numero_muestra: number
  hora: string | null
  lote: string | null
  no_racimo: string | null
  cinta: string | null
  edad_cinta: string | null
  grado_sudbasal: number | null
  grado_apical: number | null
  no_manos: number | null
  largo_apical: number | null
  peso_fruta_premium: number | null
  peso_fruta_corta: number | null
  peso_merma: number | null
  vastago_corona: number | null
  created_at: string
}

export interface PerfilRacimoDefecto {
  id: string
  evaluacion_id: string
  numero_muestra: number
  grupo: string
  defecto: string
  cantidad: number
}

export interface PerfilRacimoEvaluacion {
  id: string
  user_id: string
  finca: string
  fecha: string
  semana: number
  created_at: string
  muestras: PerfilRacimoMuestra[]
  defectos: PerfilRacimoDefecto[]
}

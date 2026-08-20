export interface PlanItem {
  id: string
  plan_id: string
  referencia: string
  pallets_plan: number
  cajas_plan: number
  created_at: string
}

export interface PlanSemana {
  id: string
  user_id: string
  anio: number
  semana: number
  finca: string
  created_at: string
  items: PlanItem[]
}

export type PlanItemInput = Omit<PlanItem, 'id' | 'plan_id' | 'created_at'>
export type PlanHeaderInput = Pick<PlanSemana, 'anio' | 'semana' | 'finca'>

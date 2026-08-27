export interface Perfil {
  user_id: string
  usuario: string
  nombre: string | null
  rol: 'admin' | 'operador'
  finca: string | null
}

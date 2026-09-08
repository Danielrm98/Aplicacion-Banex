export interface Perfil {
  user_id: string
  usuario: string
  nombre: string | null
  rol: 'admin' | 'operador'
  // Ya no se usa para el control de acceso; ver PerfilConFincas / perfil_fincas.
  finca: string | null
}

export interface PerfilConFincas extends Perfil {
  fincas: string[]
}

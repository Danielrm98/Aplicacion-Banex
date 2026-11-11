export interface Perfil {
  user_id: string
  usuario: string
  nombre: string | null
  // "admin_lectura" ve exactamente lo mismo que el admin en las fincas que
  // se le asignen (como un operador), pero no puede crear, editar ni
  // eliminar nada.
  rol: 'admin' | 'operador' | 'admin_lectura'
  // Ya no se usa para el control de acceso; ver PerfilConFincas / perfil_fincas.
  finca: string | null
}

export interface PerfilConFincas extends Perfil {
  fincas: string[]
}

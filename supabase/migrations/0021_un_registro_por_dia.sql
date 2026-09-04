-- Un operador de finca no puede crear un segundo registro de producción
-- para el mismo día si ya existe uno: debe editar el que ya hay. El
-- administrador no tiene esta restricción (por ejemplo, para correcciones).
create or replace function public.existe_produccion_mismo_dia(p_finca text, p_fecha date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.producciones
    where finca = p_finca and fecha = p_fecha
  );
$$;

drop policy "Insertar producciones según rol" on public.producciones;
create policy "Insertar producciones según rol"
  on public.producciones for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or (
        finca = public.finca_de(auth.uid())
        and not public.existe_produccion_mismo_dia(finca, fecha)
      )
    )
  );

-- Eliminar registros (o sus líneas) queda reservado al administrador; los
-- operadores solo pueden editar lo ya ingresado.
drop policy "Eliminar producciones según rol" on public.producciones;
create policy "Eliminar producciones según rol"
  on public.producciones for delete
  using (public.es_admin(auth.uid()));

drop policy "Eliminar items según rol" on public.produccion_items;
create policy "Eliminar items según rol"
  on public.produccion_items for delete
  using (public.es_admin(auth.uid()));

drop policy "Eliminar transportes según rol" on public.transportes;
create policy "Eliminar transportes según rol"
  on public.transportes for delete
  using (public.es_admin(auth.uid()));

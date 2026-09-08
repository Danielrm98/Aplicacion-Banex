-- Un operador puede quedar asignado a varias fincas (antes solo a una). Se
-- agrega una tabla de asignación (una fila por finca por usuario) y se migran
-- las asignaciones existentes de perfiles.finca hacia ella.
create table public.perfil_fincas (
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  created_at timestamptz not null default now(),
  primary key (user_id, finca)
);

alter table public.perfil_fincas enable row level security;

create policy "Cada quien ve sus fincas asignadas, el admin ve todas"
  on public.perfil_fincas for select
  using (auth.uid() = user_id or public.es_admin(auth.uid()));

create policy "Solo el admin asigna fincas"
  on public.perfil_fincas for insert
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin quita fincas"
  on public.perfil_fincas for delete
  using (public.es_admin(auth.uid()));

insert into public.perfil_fincas (user_id, finca)
select user_id, finca from public.perfiles where finca is not null
on conflict do nothing;

-- Nota: no se puede cambiar el tipo de retorno de finca_de(uuid) (de text a
-- text[]) con "create or replace", así que se deja esa función vieja tal
-- cual y se crea esta nueva con otro nombre; todas las políticas que usaban
-- finca_de(...) pasan a usar fincas_de(...) con ANY(...) más abajo.
create or replace function public.fincas_de(uid uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(finca), array[]::text[]) from public.perfil_fincas where user_id = uid;
$$;

alter policy "Ver lluvia reportada según rol"
  on public.lluvia_reportada
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Insertar lluvia reportada según rol"
  on public.lluvia_reportada
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  );

alter policy "Actualizar lluvia reportada según rol"
  on public.lluvia_reportada
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Eliminar lluvia reportada según rol"
  on public.lluvia_reportada
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Ver producciones según rol"
  on public.producciones
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Insertar producciones según rol"
  on public.producciones
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or (
        finca = any (public.fincas_de(auth.uid()))
        and not public.existe_produccion_mismo_dia(finca, fecha)
      )
    )
  );

alter policy "Actualizar producciones según rol"
  on public.producciones
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Ver items según rol"
  on public.produccion_items
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Insertar items según rol"
  on public.produccion_items
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Actualizar items según rol"
  on public.produccion_items
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Ver transportes según rol"
  on public.transportes
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Insertar transportes según rol"
  on public.transportes
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Actualizar transportes según rol"
  on public.transportes
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Ver planes según rol"
  on public.planes_semana
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Crear planes según rol"
  on public.planes_semana
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  );

alter policy "Actualizar planes según rol"
  on public.planes_semana
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Eliminar planes según rol"
  on public.planes_semana
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

alter policy "Ver items de plan según rol"
  on public.plan_items
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Insertar items de plan según rol"
  on public.plan_items
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Actualizar items de plan según rol"
  on public.plan_items
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ))
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

alter policy "Eliminar items de plan según rol"
  on public.plan_items
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_de(auth.uid())))
  ));

-- Ahora que ninguna política usa finca_de(...), se puede quitar sin CASCADE
-- (si esto falla, algo se quedó sin migrar arriba).
drop function public.finca_de(uuid);

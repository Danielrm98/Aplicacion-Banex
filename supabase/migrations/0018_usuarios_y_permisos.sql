-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega usuarios internos (usuario + rol + finca asignada) y cambia el
-- modelo de permisos: antes cada login solo veía lo que él mismo había
-- registrado (auth.uid() = user_id); ahora un "admin" ve y registra todas
-- las fincas, y un "operador" solo ve/registra la finca que se le asignó.
--
-- El usuario que ya existe hoy (el dueño de la cuenta) queda migrado
-- automáticamente como admin, sin ningún cambio en lo que puede ver o
-- hacer.

-- ============================================================
-- Perfiles: usuario interno, rol y finca asignada
-- ============================================================
create table public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique,
  nombre text,
  rol text not null default 'operador' check (rol in ('admin', 'operador')),
  finca text references public.fincas (nombre),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Funciones auxiliares (security definer: leen perfiles sin pasar por su
-- propio RLS, para evitar recursión al usarlas dentro de otras políticas).
create or replace function public.es_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select rol = 'admin' from public.perfiles where user_id = uid), false);
$$;

create or replace function public.finca_de(uid uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select finca from public.perfiles where user_id = uid;
$$;

drop policy if exists "Cada quien ve su perfil, el admin ve todos" on public.perfiles;
create policy "Cada quien ve su perfil, el admin ve todos"
  on public.perfiles for select
  using (auth.uid() = user_id or public.es_admin(auth.uid()));

drop policy if exists "Solo el admin asigna rol y finca" on public.perfiles;
create policy "Solo el admin asigna rol y finca"
  on public.perfiles for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

-- Backfill: el/los usuario(s) que ya existían quedan como admin.
insert into public.perfiles (user_id, usuario, nombre, rol, finca)
select id, split_part(email, '@', 1), email, 'admin', null
from auth.users
on conflict (user_id) do nothing;

-- ============================================================
-- producciones: visibilidad por finca asignada (admin ve todo)
-- ============================================================
drop policy if exists "Los usuarios ven solo sus registros" on public.producciones;
create policy "Ver producciones según rol"
  on public.producciones for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

drop policy if exists "Los usuarios insertan sus propios registros" on public.producciones;
create policy "Insertar producciones según rol"
  on public.producciones for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

drop policy if exists "Los usuarios actualizan sus propios registros" on public.producciones;
create policy "Actualizar producciones según rol"
  on public.producciones for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

drop policy if exists "Los usuarios eliminan sus propios registros" on public.producciones;
create policy "Eliminar producciones según rol"
  on public.producciones for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

-- ============================================================
-- produccion_items: sigue la visibilidad de su producción
-- ============================================================
drop policy if exists "Los usuarios ven items de sus registros" on public.produccion_items;
create policy "Ver items según rol"
  on public.produccion_items for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios insertan items en sus registros" on public.produccion_items;
create policy "Insertar items según rol"
  on public.produccion_items for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios actualizan items de sus registros" on public.produccion_items;
create policy "Actualizar items según rol"
  on public.produccion_items for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios eliminan items de sus registros" on public.produccion_items;
create policy "Eliminar items según rol"
  on public.produccion_items for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

-- ============================================================
-- transportes: sigue la visibilidad de su producción
-- ============================================================
drop policy if exists "Los usuarios ven transportes de sus registros" on public.transportes;
create policy "Ver transportes según rol"
  on public.transportes for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios insertan transportes en sus registros" on public.transportes;
create policy "Insertar transportes según rol"
  on public.transportes for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios actualizan transportes de sus registros" on public.transportes;
create policy "Actualizar transportes según rol"
  on public.transportes for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios eliminan transportes de sus registros" on public.transportes;
create policy "Eliminar transportes según rol"
  on public.transportes for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

-- ============================================================
-- planes_semana: visibilidad por finca asignada (admin ve todo)
-- ============================================================
drop policy if exists "Los usuarios ven sus propios planes" on public.planes_semana;
create policy "Ver planes según rol"
  on public.planes_semana for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

drop policy if exists "Los usuarios crean sus propios planes" on public.planes_semana;
create policy "Crear planes según rol"
  on public.planes_semana for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

drop policy if exists "Los usuarios actualizan sus propios planes" on public.planes_semana;
create policy "Actualizar planes según rol"
  on public.planes_semana for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

drop policy if exists "Los usuarios eliminan sus propios planes" on public.planes_semana;
create policy "Eliminar planes según rol"
  on public.planes_semana for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

-- ============================================================
-- plan_items: sigue la visibilidad de su plan
-- ============================================================
drop policy if exists "Los usuarios ven items de sus planes" on public.plan_items;
create policy "Ver items de plan según rol"
  on public.plan_items for select
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios insertan items en sus planes" on public.plan_items;
create policy "Insertar items de plan según rol"
  on public.plan_items for insert
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios actualizan items de sus planes" on public.plan_items;
create policy "Actualizar items de plan según rol"
  on public.plan_items for update
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ))
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

drop policy if exists "Los usuarios eliminan items de sus planes" on public.plan_items;
create policy "Eliminar items de plan según rol"
  on public.plan_items for delete
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

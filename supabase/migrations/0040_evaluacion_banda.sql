-- "Evaluación de banda": seguimiento de defectos de empacadora por finca y
-- día, agrupados igual que el formato en papel que ya usan las fincas
-- (AMBIENTE, COSECHA, CULTIVO, EMPAQUE, ENFERMEDAD, ANIMAL), cada uno con su
-- propia lista de defectos. El operario cuenta cuántos dedos presentan cada
-- defecto, y aparte ingresa la merma real de finca de ese día (dato externo,
-- no calculado por la app) para que la app reparta esa merma entre los
-- grupos según el peso de cada uno dentro de lo evaluado.
create table public.evaluaciones_banda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  fecha date not null,
  semana integer not null check (semana between 1 and 53),
  merma_finca numeric check (merma_finca >= 0 and merma_finca <= 100),
  created_at timestamptz not null default now(),
  unique (finca, fecha)
);

create index evaluaciones_banda_finca_fecha_idx
  on public.evaluaciones_banda (finca, fecha desc);

alter table public.evaluaciones_banda enable row level security;

-- Igual que existe_produccion_mismo_dia: evita que un operario cree una
-- segunda evaluación para la misma finca y fecha (debe editar la existente);
-- el administrador no tiene esta restricción.
create or replace function public.existe_evaluacion_banda_mismo_dia(p_finca text, p_fecha date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.evaluaciones_banda
    where finca = p_finca and fecha = p_fecha
  );
$$;

create policy "Ver evaluaciones de banda según rol"
  on public.evaluaciones_banda for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Insertar evaluaciones de banda según rol"
  on public.evaluaciones_banda for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or (
        finca = any (public.fincas_de(auth.uid()))
        and not public.existe_evaluacion_banda_mismo_dia(finca, fecha)
      )
    )
  );

create policy "Actualizar evaluaciones de banda según rol"
  on public.evaluaciones_banda for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Solo el admin elimina evaluaciones de banda"
  on public.evaluaciones_banda for delete
  using (public.es_admin(auth.uid()));

-- ============================================================
-- Detalle: una fila por defecto con cantidad > 0 dentro de una evaluación.
-- El formulario envía la cuadrícula completa de una vez (borra y vuelve a
-- insertar las filas de esa evaluación), así que el operario de la finca
-- también puede insertar/actualizar/eliminar aquí, no solo el admin.
-- ============================================================
create table public.evaluacion_banda_items (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.evaluaciones_banda (id) on delete cascade,
  grupo text not null,
  defecto text not null,
  cantidad integer not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  unique (evaluacion_id, grupo, defecto)
);

create index evaluacion_banda_items_evaluacion_idx
  on public.evaluacion_banda_items (evaluacion_id);

alter table public.evaluacion_banda_items enable row level security;

create policy "Ver items de evaluación de banda según rol"
  on public.evaluacion_banda_items for select
  using (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

create policy "Insertar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for insert
  with check (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

create policy "Actualizar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for update
  using (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ))
  with check (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

create policy "Eliminar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for delete
  using (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

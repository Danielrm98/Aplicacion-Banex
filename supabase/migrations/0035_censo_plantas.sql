-- Censo de plantas (paridas / sin parir) por lote, reportado junto con el
-- repique semanal en "Registro de repique". A diferencia de "repiques" (que
-- es por edad de racimo embolsado), esto es un conteo de plantas de la
-- semana en curso, no ligado a ninguna semana de embolse pasada.

create table public.censo_plantas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  anio integer not null,
  semana integer not null check (semana between 1 and 53),
  paridas integer not null default 0 check (paridas >= 0),
  sin_parir integer not null default 0 check (sin_parir >= 0),
  created_at timestamptz not null default now(),
  unique (lote_id, anio, semana)
);

create index censo_plantas_lote_idx on public.censo_plantas (lote_id);

alter table public.censo_plantas enable row level security;

create policy "Ver censo de plantas según rol"
  on public.censo_plantas for select
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  );

create policy "Registrar censo de plantas según rol"
  on public.censo_plantas for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Corregir censo de plantas según rol"
  on public.censo_plantas for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Solo el admin elimina censo de plantas"
  on public.censo_plantas for delete
  using (public.es_admin(auth.uid()));

-- Menú "Embolses": lotes por finca y el conteo semanal de racimos
-- embolsados por lote. "empresa" agrupa fincas para los subtotales del
-- reporte semanal (BANEX / AGROMAYOR / BIOTAIRONA, u otra que se agregue).

alter table public.fincas add column empresa text;

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  finca text not null references public.fincas (nombre),
  nombre text not null,
  hectareas numeric,
  created_at timestamptz not null default now(),
  unique (finca, nombre)
);

alter table public.lotes enable row level security;

create policy "Ver lotes según rol"
  on public.lotes for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Solo el admin administra lotes"
  on public.lotes for all
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

create table public.embolses (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  anio integer not null,
  -- 53 porque algunos años ISO tienen una semana 53; el "año de embolses"
  -- siempre arranca en la semana 42 del año calendario anterior.
  semana integer not null check (semana between 1 and 53),
  cantidad integer not null default 0 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  unique (lote_id, anio, semana)
);

create index embolses_lote_idx on public.embolses (lote_id);

alter table public.embolses enable row level security;

create policy "Ver embolses según rol"
  on public.embolses for select
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = embolses.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  );

-- El admin o el operario de la finca del lote puede registrar/corregir el
-- conteo semanal (upsert); no hay policy de delete para operario — corregir
-- un número es volver a guardar esa celda con el valor correcto.
create policy "Registrar embolses según rol"
  on public.embolses for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = embolses.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Corregir embolses según rol"
  on public.embolses for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = embolses.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = embolses.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Solo el admin elimina embolses"
  on public.embolses for delete
  using (public.es_admin(auth.uid()));

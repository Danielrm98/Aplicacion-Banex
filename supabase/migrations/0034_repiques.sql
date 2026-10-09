-- Menú "Registro de repique" / "Repiques": racimos ya embolsados que se
-- descartan antes de cosecha (viento, lluvia, problemas fisiológicos). Se
-- registran por lote y por la edad en semanas que tenían al momento del
-- repique, lo que identifica exactamente a qué semana de embolse (y por lo
-- tanto a qué color de cinta) pertenecían. El inventario neto de cada
-- semana de embolse se calcula restando esto de "embolses" en la app — esta
-- tabla nunca modifica ni borra el conteo original de embolses, que sigue
-- siendo el reporte histórico de lo realmente embolsado.

create table public.repiques (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Semana real (y año) del embolse afectado — mismo significado que
  -- embolses.anio/semana, para poder cruzarlas directo.
  anio_embolse integer not null,
  semana_embolse integer not null check (semana_embolse between 1 and 53),
  -- La edad en semanas tal como se reportó, para mostrarla en pantalla sin
  -- tener que recalcularla a partir de la semana de hoy (que cambia).
  edad_semanas integer not null check (edad_semanas between 1 and 53),
  cantidad integer not null default 0 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  unique (lote_id, anio_embolse, semana_embolse)
);

create index repiques_lote_idx on public.repiques (lote_id);

alter table public.repiques enable row level security;

create policy "Ver repiques según rol"
  on public.repiques for select
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = repiques.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  );

create policy "Registrar repiques según rol"
  on public.repiques for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = repiques.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Corregir repiques según rol"
  on public.repiques for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = repiques.lote_id and l.finca = any (public.fincas_de(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = repiques.lote_id and l.finca = any (public.fincas_de(auth.uid()))
      )
    )
  );

create policy "Solo el admin elimina repiques"
  on public.repiques for delete
  using (public.es_admin(auth.uid()));

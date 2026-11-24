-- ============================================================
-- Escalera de producción: proyecta, a partir del embolse semanal, en qué
-- semana futura se va a cosechar cada cohorte y cuántos racimos va a
-- rendir (misma lógica que ya manejan en Excel, ahora viva en la app).
--
-- cosecha_por_edad: de los racimos cosechados cada semana, cuántos traían
-- cinta de cada edad (8 a 13 semanas desde el embolse). Es un dato que hoy
-- se tecleaba a mano en el Excel; aquí se captura por finca (no por lote,
-- porque esa clasificación se hace sobre la fruta ya mezclada en el
-- proceso, no en el lote de origen) y también sirve de semilla histórica
-- importada del Excel para los años anteriores al arranque de esta app.
-- ============================================================
create table public.cosecha_por_edad (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  anio integer not null,
  semana integer not null check (semana between 1 and 53),
  edad_semanas integer not null check (edad_semanas between 8 and 13),
  racimos integer not null default 0 check (racimos >= 0),
  created_at timestamptz not null default now(),
  unique (finca, anio, semana, edad_semanas)
);

create index cosecha_por_edad_finca_idx on public.cosecha_por_edad (finca, anio, semana);

alter table public.cosecha_por_edad enable row level security;

create policy "Ver cosecha por edad según rol"
  on public.cosecha_por_edad for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Registrar cosecha por edad según rol"
  on public.cosecha_por_edad for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

create policy "Corregir cosecha por edad según rol"
  on public.cosecha_por_edad for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

create policy "Solo el admin elimina cosecha por edad"
  on public.cosecha_por_edad for delete
  using (public.es_admin(auth.uid()));

-- ============================================================
-- escalera_embolse_historico: semilla histórica de embolse real por finca
-- (no por lote: antes del arranque de "embolses" en la app no hay ese
-- desglose). Solo se llena una vez con el script de importación del
-- Excel, corriendo con la service role key — no tiene policy de
-- insert/update para operarios ni admins, solo lectura.
-- ============================================================
create table public.escalera_embolse_historico (
  finca text not null references public.fincas (nombre),
  anio integer not null,
  semana integer not null check (semana between 1 and 53),
  hectareas numeric,
  bell_por_ha numeric,
  emb_real numeric,
  created_at timestamptz not null default now(),
  primary key (finca, anio, semana)
);

alter table public.escalera_embolse_historico enable row level security;

create policy "Ver historico de embolse según rol"
  on public.escalera_embolse_historico for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

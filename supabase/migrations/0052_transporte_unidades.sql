-- Plan diario de transporte: el administrador asigna qué unidades (flota
-- fija, numeradas) van a cuál finca cada día, y el operario de esa finca
-- registra la llegada (camión o contenedor, con sus propios campos) cuando
-- la unidad llega de verdad. Nace con los campos de registro en null (igual
-- que ventas_canastillas con factura_path) y el operario los llena después.
create table public.transporte_unidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  fecha date not null,
  numero_unidad integer not null check (numero_unidad >= 1),
  tipo text check (tipo in ('Contenedor', 'Camión')),
  placa text,
  numero_contenedor text,
  sello_entrada text,
  sello_salida text,
  hora_llegada time,
  hora_salida time,
  created_at timestamptz not null default now(),
  -- Evita planificar la misma unidad dos veces en la misma finca el mismo
  -- día; no bloquea que esa unidad también vaya a OTRA finca ese día (una
  -- unidad puede hacer varios recorridos).
  unique (finca, fecha, numero_unidad)
);

create index transporte_unidades_finca_fecha_idx on public.transporte_unidades (finca, fecha desc);

alter table public.transporte_unidades enable row level security;

create policy "Ver transporte según rol"
  on public.transporte_unidades for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Solo el admin crea el plan de transporte"
  on public.transporte_unidades for insert
  with check (auth.uid() = user_id and public.es_admin(auth.uid()));

create policy "Registrar llegada de transporte según rol"
  on public.transporte_unidades for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

create policy "Solo el admin elimina el plan de transporte"
  on public.transporte_unidades for delete
  using (public.es_admin(auth.uid()));

-- Ejecutar en el SQL Editor del proyecto Supabase (https://app.supabase.com -> tu proyecto -> SQL Editor)
-- Instalación nueva (proyecto sin la tabla producciones todavía).
-- Si tu proyecto ya tiene datos de una versión anterior, usa en su lugar
-- supabase/migrations/0003_multi_referencia.sql

-- ============================================================
-- Catálogo de marcas / referencias (gestionable desde la app)
-- ============================================================
create table public.referencias (
  marca text primary key,
  cajas_pallet integer not null,
  factor_conversion numeric not null,
  tipo_caja text not null check (tipo_caja in ('Convencional', 'Orgánica')),
  especificacion text not null check (especificacion in ('Corta', 'Larga')),
  peso_neto_kg numeric not null check (peso_neto_kg >= 0),
  especificacion_pdf_path text
);

alter table public.referencias enable row level security;

create policy "Usuarios autenticados leen el catálogo"
  on public.referencias for select
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados crean referencias"
  on public.referencias for insert
  with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados eliminan referencias"
  on public.referencias for delete
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados editan referencias"
  on public.referencias for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.referencias (marca, cajas_pallet, factor_conversion, tipo_caja, especificacion, peso_neto_kg) values
  ('20LD7RA', 55, 0.9297, 'Convencional', 'Corta', 17.20),
  ('AGSTDBVRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('AGSTDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('AH1BDBVRA', 54, 1.0216, 'Convencional', 'Larga', 18.90),
  ('AH1BDRA', 54, 1.0216, 'Convencional', 'Larga', 18.90),
  ('AH23XBD', 54, 1.0216, 'Convencional', 'Larga', 18.90),
  ('AH23XBDBV', 54, 1.0216, 'Convencional', 'Larga', 18.90),
  ('ALD20X7EPSRA', 55, 0.9297, 'Convencional', 'Corta', 17.20),
  ('ALD20X7RA', 54, 0.9297, 'Convencional', 'Corta', 17.20),
  ('ALSTDEPSBVRA', 55, 0.9351, 'Convencional', 'Larga', 17.30),
  ('ALSTDEPSRA', 55, 0.9351, 'Convencional', 'Larga', 17.30),
  ('AS17X6PBRA', 55, 0.8540, 'Convencional', 'Larga', 15.80),
  ('AS17X6RA', 55, 0.8540, 'Convencional', 'Larga', 15.80),
  ('ASGG20X7PBRA', 55, 0.8918, 'Convencional', 'Corta', 16.50),
  ('ASGG20X7RA', 55, 0.8918, 'Convencional', 'Corta', 16.50),
  ('ASSTD17RA', 55, 0.9432, 'Convencional', 'Larga', 17.45),
  ('AUMINIBDBV', 54, 1.0000, 'Convencional', 'Corta', 18.50),
  ('CHIQUITA 404', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('CHIQUITAORG', 48, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('CLSIEGEL', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('CLSMLRA', 66, 0.7027, 'Convencional', 'Corta', 13.00),
  ('CLSTDBVRA', 55, 0.8924, 'Convencional', 'Larga', 16.51),
  ('CLSTDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('CLWSTD', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('CLWSTDBV', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('CODOR13X1,3', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('CPSIEGEL', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('ED21X5BDBVRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('ED21X5BDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('EDKORG', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('FF20X5PBRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('FFB20X5IFPBBVRA', 55, 0.8864, 'Convencional', 'Corta', 16.40),
  ('FFB20X5IFPBRA', 55, 0.8865, 'Convencional', 'Larga', 16.40),
  ('FFB20X5PBRA', 55, 0.8486, 'Convencional', 'Larga', 15.70),
  ('FP12X8RA', 55, 0.9081, 'Convencional', 'Larga', 16.80),
  ('FP12X8SRA', 55, 0.7189, 'Convencional', 'Corta', 13.30),
  ('FPX5RA', 66, 0.7189, 'Convencional', 'Corta', 13.30),
  ('FSS19X7IFPBRA', 55, 0.9459, 'Convencional', 'Corta', 17.50),
  ('FSS19X7PBIFBVRA', 55, 0.9459, 'Convencional', 'Corta', 17.50),
  ('FSS19X7PBIFRA', 55, 0.9459, 'Convencional', 'Corta', 17.50),
  ('FSS19X7PBRA', 55, 0.9459, 'Convencional', 'Corta', 17.50),
  ('IMPP26X5BD', 54, 1.0000, 'Convencional', 'Corta', 18.50),
  ('IMPP26X5BDBV', 54, 0.8135, 'Convencional', 'Corta', 15.05),
  ('LD17RA', 55, 0.9432, 'Convencional', 'Larga', 17.45),
  ('LDPP17RA', 55, 0.9432, 'Convencional', 'Larga', 17.45),
  ('M20X5IFPBDRA', 0, 0.0000, 'Convencional', 'Larga', 0),
  ('M20X5IFPBRA', 55, 0.8865, 'Convencional', 'Larga', 16.40),
  ('M20X5PBRA', 54, 0.8865, 'Convencional', 'Larga', 16.40),
  ('M22X6IFPBRA', 55, 0.8757, 'Convencional', 'Corta', 16.20),
  ('M22X6PBRA', 54, 0.8757, 'Convencional', 'Corta', 16.20),
  ('MARIOBVRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('MARIORA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('MPBORG303', 48, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('MSSMX5PBRA', 54, 0.8648, 'Convencional', 'Corta', 16.00),
  ('MSSTDBVRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('MSSTDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('MSTDIFBVRA', 55, 0.9567, 'Convencional', 'Larga', 17.70),
  ('MSTDIFRA', 55, 0.9568, 'Convencional', 'Larga', 17.70),
  ('MSTDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('NETTOBIOBDOR', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('ORG2LB338', 48, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('SIEGELBV', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('SIEGELCA', 54, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('SIEGELCA-ENSAYO', 0, 0.0000, 'Orgánica', 'Larga', 0),
  ('SMLRA', 66, 0.7027, 'Convencional', 'Corta', 13.00),
  ('SPARRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('STD', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('STDBV', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('STDBVRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('STDRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('STDSBVRA', 54, 1.0000, 'Convencional', 'Corta', 18.50),
  ('STDSRA', 54, 1.0000, 'Convencional', 'Corta', 18.50),
  ('WALMORG337', 48, 1.0000, 'Orgánica', 'Larga', 18.50),
  ('MS28X5PBRA', 54, 1.0000, 'Convencional', 'Larga', 18.50),
  ('EDKORG-ENSAYO', 54, 1.0000, 'Orgánica', 'Larga', 18.50);

-- ============================================================
-- Catálogo de fincas (gestionable desde la app): hectareaje total
-- ============================================================
create table public.fincas (
  nombre text primary key,
  hectareas numeric check (hectareas >= 0),
  latitud numeric check (latitud between -90 and 90),
  longitud numeric check (longitud between -180 and 180),
  responsable_nombre text,
  responsable_correo text
);

alter table public.fincas enable row level security;

create policy "Usuarios autenticados leen el catálogo de fincas"
  on public.fincas for select
  using (auth.role() = 'authenticated');

create policy "Usuarios autenticados agregan fincas"
  on public.fincas for insert
  with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados actualizan el hectareaje"
  on public.fincas for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.fincas (nombre) values
  ('TAMACARA'),
  ('FLORIDA'),
  ('LAS DELICIAS'),
  ('DILIA ESTHER'),
  ('GOLONDRINA NUEVA'),
  ('GOLONDRINA VIEJA'),
  ('GLORIA MERCEDES'),
  ('LUCILA MARINA'),
  ('ESMERALDA'),
  ('LA MARIA'),
  ('TROPICANA'),
  ('COSTANERA'),
  ('RAQUELITA'),
  ('MILADY'),
  ('MACONDO');

-- ============================================================
-- Perfiles: usuario interno, rol (admin ve todo / operador solo su
-- finca asignada) y funciones auxiliares para las políticas de abajo
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

create policy "Cada quien ve su perfil, el admin ve todos"
  on public.perfiles for select
  using (auth.uid() = user_id or public.es_admin(auth.uid()));

create policy "Solo el admin asigna rol y finca"
  on public.perfiles for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

-- El primer usuario que se registre (el dueño de la cuenta) queda como admin.
insert into public.perfiles (user_id, usuario, nombre, rol, finca)
select id, split_part(email, '@', 1), email, 'admin', null
from auth.users
on conflict (user_id) do nothing;

-- ============================================================
-- Especificaciones en PDF por referencia (bucket privado de Storage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('especificaciones', 'especificaciones', false)
on conflict (id) do nothing;

create policy "Usuarios autenticados ven especificaciones"
  on storage.objects for select
  using (bucket_id = 'especificaciones' and auth.role() = 'authenticated');

create policy "Solo el admin sube especificaciones"
  on storage.objects for insert
  with check (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));

create policy "Solo el admin reemplaza especificaciones"
  on storage.objects for update
  using (bucket_id = 'especificaciones' and public.es_admin(auth.uid()))
  with check (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));

create policy "Solo el admin elimina especificaciones"
  on storage.objects for delete
  using (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));

-- ============================================================
-- Lluvia reportada manualmente por finca y día (más confiable que el
-- pronóstico para lluvia convectiva muy localizada)
-- ============================================================
create table public.lluvia_reportada (
  id uuid primary key default gen_random_uuid(),
  finca text not null references public.fincas (nombre),
  fecha date not null,
  milimetros numeric not null check (milimetros >= 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (finca, fecha)
);

alter table public.lluvia_reportada enable row level security;

create policy "Ver lluvia reportada según rol"
  on public.lluvia_reportada for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Insertar lluvia reportada según rol"
  on public.lluvia_reportada for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

create policy "Actualizar lluvia reportada según rol"
  on public.lluvia_reportada for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Eliminar lluvia reportada según rol"
  on public.lluvia_reportada for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

-- ============================================================
-- Cabecera de producción: un registro por día + finca
-- ============================================================
create table public.producciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  hora_finalizacion time,
  semana integer check (semana between 1 and 53),
  finca text not null,
  area_recorrida numeric check (area_recorrida >= 0),
  racimos_semana_7 integer not null default 0 check (racimos_semana_7 >= 0),
  racimos_semana_8 integer not null default 0 check (racimos_semana_8 >= 0),
  racimos_semana_9 integer not null default 0 check (racimos_semana_9 >= 0),
  racimos_semana_10 integer not null default 0 check (racimos_semana_10 >= 0),
  racimos_semana_11 integer not null default 0 check (racimos_semana_11 >= 0),
  racimos_semana_12 integer not null default 0 check (racimos_semana_12 >= 0),
  grado_semana_7 numeric,
  grado_semana_8 numeric,
  grado_semana_9 numeric,
  grado_semana_10 numeric,
  grado_semana_11 numeric,
  grado_semana_12 numeric,
  racimos_recusados integer not null default 0 check (racimos_recusados >= 0),
  canastillas integer not null default 0 check (canastillas >= 0),
  notas text,
  created_at timestamptz not null default now()
);

create index producciones_user_fecha_idx
  on public.producciones (user_id, fecha desc);

alter table public.producciones enable row level security;

create policy "Ver producciones según rol"
  on public.producciones for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Insertar producciones según rol"
  on public.producciones for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

create policy "Actualizar producciones según rol"
  on public.producciones for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Eliminar producciones según rol"
  on public.producciones for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

-- ============================================================
-- Detalle: una fila por referencia dentro de un registro
-- ============================================================
create table public.produccion_items (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references public.producciones (id) on delete cascade,
  referencia text not null references public.referencias (marca),
  cantidad_cajas integer not null check (cantidad_cajas > 0),
  peso_neto_kg numeric not null check (peso_neto_kg >= 0),
  cajas_20kg numeric not null check (cajas_20kg >= 0),
  cajas_rechazadas integer not null default 0 check (cajas_rechazadas >= 0),
  motivo_rechazo text,
  created_at timestamptz not null default now()
);

create index produccion_items_produccion_idx
  on public.produccion_items (produccion_id);

alter table public.produccion_items enable row level security;

create policy "Ver items según rol"
  on public.produccion_items for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

create policy "Insertar items según rol"
  on public.produccion_items for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

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

create policy "Eliminar items según rol"
  on public.produccion_items for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

-- ============================================================
-- Transporte: llegadas/salidas de camiones o contenedores por registro
-- ============================================================
create table public.transportes (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references public.producciones (id) on delete cascade,
  tipo text not null check (tipo in ('Contenedor', 'Camión')),
  hora_llegada time,
  hora_salida time,
  placa text,
  sello text,
  created_at timestamptz not null default now()
);

create index transportes_produccion_idx
  on public.transportes (produccion_id);

alter table public.transportes enable row level security;

create policy "Ver transportes según rol"
  on public.transportes for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

create policy "Insertar transportes según rol"
  on public.transportes for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

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

create policy "Eliminar transportes según rol"
  on public.transportes for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

-- ============================================================
-- Plan semanal por finca: metas de cajas por referencia
-- ============================================================
create table public.planes_semana (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  anio integer not null,
  semana integer not null check (semana between 1 and 53),
  finca text not null,
  created_at timestamptz not null default now(),
  unique (user_id, anio, semana, finca)
);

alter table public.planes_semana enable row level security;

create policy "Ver planes según rol"
  on public.planes_semana for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Crear planes según rol"
  on public.planes_semana for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

create policy "Actualizar planes según rol"
  on public.planes_semana for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Eliminar planes según rol"
  on public.planes_semana for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

-- ============================================================
-- Detalle del plan: cajas meta por referencia
-- ============================================================
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_semana (id) on delete cascade,
  referencia text not null references public.referencias (marca),
  pallets_plan numeric not null check (pallets_plan >= 0),
  cajas_plan integer not null check (cajas_plan >= 0),
  created_at timestamptz not null default now(),
  unique (plan_id, referencia)
);

create index plan_items_plan_idx
  on public.plan_items (plan_id);

alter table public.plan_items enable row level security;

create policy "Ver items de plan según rol"
  on public.plan_items for select
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

create policy "Insertar items de plan según rol"
  on public.plan_items for insert
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

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

create policy "Eliminar items de plan según rol"
  on public.plan_items for delete
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = public.finca_de(auth.uid()))
  ));

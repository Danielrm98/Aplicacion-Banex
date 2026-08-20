-- Ejecutar en el SQL Editor de tu proyecto Supabase ya existente.
-- Reemplaza la tabla producciones plana por el modelo cabecera/detalle
-- + catálogo de referencias. Esto elimina cualquier producciones de prueba
-- que hayas guardado hasta ahora (drop cascade).

drop table if exists public.referencias cascade;
drop table if exists public.producciones cascade;


-- ============================================================
-- Catálogo de marcas / referencias (solo lectura desde la app)
-- ============================================================
create table public.referencias (
  marca text primary key,
  cajas_pallet integer not null,
  factor_conversion numeric not null,
  tipo_caja text not null check (tipo_caja in ('Convencional', 'Orgánica')),
  especificacion text not null check (especificacion in ('Corta', 'Larga')),
  peso_neto_kg numeric not null check (peso_neto_kg >= 0)
);

alter table public.referencias enable row level security;

create policy "Usuarios autenticados leen el catálogo"
  on public.referencias for select
  using (auth.role() = 'authenticated');

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
-- Cabecera de producción: un registro por día + finca
-- ============================================================
create table public.producciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  semana integer check (semana between 1 and 53),
  finca text not null,
  notas text,
  created_at timestamptz not null default now()
);

create index producciones_user_fecha_idx
  on public.producciones (user_id, fecha desc);

alter table public.producciones enable row level security;

create policy "Los usuarios ven solo sus registros"
  on public.producciones for select
  using (auth.uid() = user_id);

create policy "Los usuarios insertan sus propios registros"
  on public.producciones for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios actualizan sus propios registros"
  on public.producciones for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Los usuarios eliminan sus propios registros"
  on public.producciones for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Detalle: una fila por referencia dentro de un registro
-- ============================================================
create table public.produccion_items (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references public.producciones (id) on delete cascade,
  referencia text not null references public.referencias (marca),
  calibre text,
  cantidad_cajas integer not null check (cantidad_cajas > 0),
  peso_neto_kg numeric not null check (peso_neto_kg >= 0),
  cajas_rechazadas integer not null default 0 check (cajas_rechazadas >= 0),
  motivo_rechazo text,
  created_at timestamptz not null default now()
);

create index produccion_items_produccion_idx
  on public.produccion_items (produccion_id);

alter table public.produccion_items enable row level security;

create policy "Los usuarios ven items de sus registros"
  on public.produccion_items for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios insertan items en sus registros"
  on public.produccion_items for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios actualizan items de sus registros"
  on public.produccion_items for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios eliminan items de sus registros"
  on public.produccion_items for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

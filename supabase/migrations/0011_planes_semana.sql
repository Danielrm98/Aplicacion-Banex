-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el plan semanal por finca (metas de cajas por referencia) y su
-- seguimiento de cumplimiento frente a la producción real.

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

create policy "Los usuarios ven sus propios planes"
  on public.planes_semana for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propios planes"
  on public.planes_semana for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios actualizan sus propios planes"
  on public.planes_semana for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Los usuarios eliminan sus propios planes"
  on public.planes_semana for delete
  using (auth.uid() = user_id);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_semana (id) on delete cascade,
  referencia text not null references public.referencias (marca),
  cajas_plan integer not null check (cajas_plan >= 0),
  created_at timestamptz not null default now(),
  unique (plan_id, referencia)
);

create index plan_items_plan_idx
  on public.plan_items (plan_id);

alter table public.plan_items enable row level security;

create policy "Los usuarios ven items de sus planes"
  on public.plan_items for select
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios insertan items en sus planes"
  on public.plan_items for insert
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios actualizan items de sus planes"
  on public.plan_items for update
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios eliminan items de sus planes"
  on public.plan_items for delete
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id and p.user_id = auth.uid()
  ));

-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega pallets_plan a plan_items: ahora la meta se ingresa en pallets y
-- las cajas (cajas_plan) se calculan y guardan automáticamente en la app.

alter table public.plan_items
  add column if not exists pallets_plan numeric not null default 0 check (pallets_plan >= 0);

alter table public.plan_items
  alter column pallets_plan drop default;

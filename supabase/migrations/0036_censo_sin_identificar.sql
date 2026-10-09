-- Racimos repicados cuya edad/color de cinta no se pudo identificar en
-- campo (aparece en las planillas de BANEX junto a "Sin Parir"). Se guarda
-- en censo_plantas (mismo registro semanal por lote que paridas/sin_parir),
-- aunque conceptualmente es un conteo de racimos, no de plantas.
alter table public.censo_plantas
  add column sin_identificar integer not null default 0 check (sin_identificar >= 0);

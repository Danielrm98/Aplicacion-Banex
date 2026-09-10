-- Permite registrar canastillas obsequiadas al personal operativo, además
-- de las vendidas, ya que también deben descontarse del acumulado
-- disponible. Se relaja el check de "cantidad" (ahora puede ser 0 si la
-- fila es puramente un obsequio) buscando la restricción por su definición
-- en vez de asumir un nombre fijo.
do $$
declare
  nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'public.ventas_canastillas'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) = 'CHECK ((cantidad > 0))';

  if nombre_restriccion is not null then
    execute format('alter table public.ventas_canastillas drop constraint %I', nombre_restriccion);
  end if;
end $$;

alter table public.ventas_canastillas
  add constraint ventas_canastillas_cantidad_check check (cantidad >= 0),
  add column cantidad_obsequio integer not null default 0 check (cantidad_obsequio >= 0),
  add constraint ventas_canastillas_al_menos_una_check check (cantidad > 0 or cantidad_obsequio > 0);

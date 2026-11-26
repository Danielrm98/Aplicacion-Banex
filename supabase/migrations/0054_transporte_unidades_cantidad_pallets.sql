-- Al asignar una unidad a una finca, el administrador ya puede decidir de
-- una vez si es Camión o Contenedor y cuántos pallets carga (antes esto se
-- dejaba para que lo registrara el operario al llegar la unidad).
alter table public.transporte_unidades
  add column cantidad_pallets integer check (cantidad_pallets is null or cantidad_pallets >= 0);

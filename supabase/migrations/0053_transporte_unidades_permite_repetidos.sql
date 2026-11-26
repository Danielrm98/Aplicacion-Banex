-- Una misma unidad SÍ puede ir más de una vez a la misma finca el mismo día
-- (pocas veces, pero pasa: un camión hace dos recorridos a la misma finca).
-- El unique original de la 0052 lo bloqueaba por error.
alter table public.transporte_unidades drop constraint transporte_unidades_finca_fecha_numero_unidad_key;

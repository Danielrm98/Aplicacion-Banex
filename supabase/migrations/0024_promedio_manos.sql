alter table public.producciones
  add column promedio_manos numeric check (promedio_manos >= 0);

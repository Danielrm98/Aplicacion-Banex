-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega la hora de finalización del proceso a la cabecera, y la placa del
-- vehículo + número de sello de seguridad (contenedores) a cada transporte.

alter table public.producciones
  add column if not exists hora_finalizacion time;

alter table public.transportes
  add column if not exists placa text,
  add column if not exists sello text;

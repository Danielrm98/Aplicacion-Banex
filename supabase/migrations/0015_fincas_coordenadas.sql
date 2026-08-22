-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega coordenadas (latitud/longitud) al catálogo de fincas, para
-- poder mostrar la ubicación y el pronóstico climático en Registrar.

alter table public.fincas
  add column if not exists latitud numeric check (latitud between -90 and 90),
  add column if not exists longitud numeric check (longitud between -180 and 180);

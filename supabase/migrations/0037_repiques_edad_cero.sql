-- La edad de repique ahora va de 0 (recién embolsado) a 12 semanas, igual
-- que en las planillas de BANEX; el límite original (1 a 53) quedó
-- desactualizado cuando se ajustó la numeración en la app.
alter table public.repiques drop constraint repiques_edad_semanas_check;
alter table public.repiques add constraint repiques_edad_semanas_check check (edad_semanas between 0 and 53);

-- "Registro de embolse" pasa a capturarse día a día: lunes a miércoles
-- conforman la 1ra vuelta y jueves a sábado la 2da vuelta. primera_vuelta y
-- segunda_vuelta siguen existiendo como el total de cada grupo de días (se
-- recalculan en la app), igual que cantidad sigue siendo el total general.

alter table public.embolses add column lunes integer;
alter table public.embolses add column martes integer;
alter table public.embolses add column miercoles integer;
alter table public.embolses add column jueves integer;
alter table public.embolses add column viernes integer;
alter table public.embolses add column sabado integer;

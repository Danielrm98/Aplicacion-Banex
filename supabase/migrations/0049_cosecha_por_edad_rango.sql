-- La escalera ya no depende de una pantalla de captura manual semanal: el
-- dato real de "racimos cosechados por edad" se toma del formulario diario
-- de Registrar (racimos_semana_7..12, ver producciones), que cubre edad
-- 7-12. El histórico importado del Excel (semilla de antes de que la app
-- existiera) trae 8-13. Se amplía el rango permitido a 7-13 para cubrir
-- ambos sin truncar ninguno.
alter table public.cosecha_por_edad drop constraint cosecha_por_edad_edad_semanas_check;
alter table public.cosecha_por_edad add constraint cosecha_por_edad_edad_semanas_check check (edad_semanas between 7 and 13);

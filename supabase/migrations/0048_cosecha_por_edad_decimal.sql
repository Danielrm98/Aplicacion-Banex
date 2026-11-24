-- El histórico de "racimos cosechados por edad" importado del Excel trae
-- al menos un valor con decimales (parece una estimación puntual de una
-- semana de transición, no un conteo manual típico). La columna se había
-- dejado como integer asumiendo que siempre sería un conteo entero; se
-- cambia a numeric para no perder ni redondear lo que de verdad dice el
-- histórico.
alter table public.cosecha_por_edad
  alter column racimos type numeric using racimos::numeric;

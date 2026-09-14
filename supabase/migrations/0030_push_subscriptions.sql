-- Notificaciones push al administrador: cada suscripción representa un
-- dispositivo/navegador donde el admin activó "Recibir notificaciones".
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "El admin ve sus propias suscripciones push"
  on public.push_subscriptions for select
  using (public.es_admin(auth.uid()) and user_id = auth.uid());

create policy "El admin crea sus propias suscripciones push"
  on public.push_subscriptions for insert
  with check (public.es_admin(auth.uid()) and user_id = auth.uid());

create policy "El admin elimina sus propias suscripciones push"
  on public.push_subscriptions for delete
  using (public.es_admin(auth.uid()) and user_id = auth.uid());

-- Push-Abos je Geraet. Ein Nutzer kann mehrere haben (Handy, Rechner),
-- deshalb eigene Tabelle statt einer Spalte im Profil.
create table if not exists public.push_subscriptions (
  endpoint    text primary key,           -- von Apple/Google vergeben, eindeutig je Geraet
  user_id     uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null,              -- oeffentlicher Schluessel des Geraets
  auth        text not null,              -- Geheimnis fuer die Verschluesselung
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Gleiche Trennung wie beim Log: jeder sieht nur seine eigenen Abos, Admin alle.
drop policy if exists subs_select_own_or_admin on public.push_subscriptions;
create policy subs_select_own_or_admin on public.push_subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists subs_insert_own on public.push_subscriptions;
create policy subs_insert_own on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists subs_update_own on public.push_subscriptions;
create policy subs_update_own on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Abmelden koennen muss man auch: iOS wirft Abos weg, wenn man die App loescht.
drop policy if exists subs_delete_own on public.push_subscriptions;
create policy subs_delete_own on public.push_subscriptions
  for delete using (user_id = auth.uid());

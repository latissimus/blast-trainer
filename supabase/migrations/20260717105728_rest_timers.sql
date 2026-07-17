-- Laufender Pausentimer, hoechstens einer je Nutzer.
--
-- Zweck ist das Abbrechen: Die Edge Function schlaeft im Hintergrund und prueft
-- vor dem Senden, ob ihre Marke noch gilt. Startet man die Pause neu oder bricht
-- ab, bekommt die Zeile eine neue Marke (oder verschwindet) – der alte,
-- schlafende Auftrag merkt das und schweigt.
create table if not exists public.rest_timers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      uuid not null,
  ends_at    timestamptz not null,
  label      text,
  updated_at timestamptz not null default now()
);

alter table public.rest_timers enable row level security;

drop policy if exists timers_select_own on public.rest_timers;
create policy timers_select_own on public.rest_timers
  for select using (user_id = auth.uid());

drop policy if exists timers_insert_own on public.rest_timers;
create policy timers_insert_own on public.rest_timers
  for insert with check (user_id = auth.uid());

drop policy if exists timers_update_own on public.rest_timers;
create policy timers_update_own on public.rest_timers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists timers_delete_own on public.rest_timers;
create policy timers_delete_own on public.rest_timers
  for delete using (user_id = auth.uid());

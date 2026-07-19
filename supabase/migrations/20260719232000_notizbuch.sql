-- Notizbuch: freie Notizen mit Links und Bildern.
--
-- EIGENE TABELLE, nicht im training_logs-Payload. Zwei Gruende, beide hart:
--
-- 1. "Neue Phase starten" leert das Payload. Das Notizbuch soll das ueberleben –
--    es ist der einzige Ort in der App, an dem etwas dauerhaft steht.
-- 2. Das Payload wird bei JEDER Eingabe im Log komplett neu hochgeladen
--    (700ms-Debounce in log.js). Baehen dort Bilder mit drin, schiebt jeder
--    Tastendruck im Training Megabytes durchs Netz.
--
-- Bilder liegen im Storage, nicht in der Datenbank. In der Zeile steht nur der
-- Pfad. Der Bucket ist PRIVAT: Trainingsfotos gehen niemanden etwas an, die App
-- holt sich zum Anzeigen signierte Links.

create table if not exists public.notizen (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  titel      text not null default '',
  text       text not null default '',
  -- Storage-Pfade, in Anzeigereihenfolge. Kein eigenes Kind-Tabellchen: Die
  -- Bilder gehoeren genau einer Notiz und werden nie einzeln abgefragt.
  bilder     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sortierung der Liste: neueste Aenderung zuerst, pro Nutzer.
create index if not exists notizen_user_idx on public.notizen (user_id, updated_at desc);

alter table public.notizen enable row level security;

drop policy if exists notizen_select_own on public.notizen;
create policy notizen_select_own on public.notizen
  for select using (user_id = auth.uid());

drop policy if exists notizen_insert_own on public.notizen;
create policy notizen_insert_own on public.notizen
  for insert with check (user_id = auth.uid());

drop policy if exists notizen_update_own on public.notizen;
create policy notizen_update_own on public.notizen
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notizen_delete_own on public.notizen;
create policy notizen_delete_own on public.notizen
  for delete using (user_id = auth.uid());

-- ---- Storage ---------------------------------------------------------------
-- Privat. Der erste Pfadabschnitt ist die User-ID; die Regeln haengen genau
-- daran, damit niemand in einem fremden Ordner liest oder schreibt.

insert into storage.buckets (id, name, public)
values ('notizbuch', 'notizbuch', false)
on conflict (id) do nothing;

drop policy if exists notizbuch_select_own on storage.objects;
create policy notizbuch_select_own on storage.objects
  for select using (
    bucket_id = 'notizbuch' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists notizbuch_insert_own on storage.objects;
create policy notizbuch_insert_own on storage.objects
  for insert with check (
    bucket_id = 'notizbuch' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists notizbuch_delete_own on storage.objects;
create policy notizbuch_delete_own on storage.objects
  for delete using (
    bucket_id = 'notizbuch' and (storage.foldername(name))[1] = auth.uid()::text
  );

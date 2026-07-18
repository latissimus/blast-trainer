-- Erfolgskontrolle: Hautfalten und Gewicht.
--
-- Bewusst ZWEI Tabellen, nicht eine: Die Rhythmen sind verschieden. Gewicht
-- wiegt man taeglich (verrauscht, Trend zaehlt), Falten misst man alle paar
-- Wochen. In einer Tabelle waeren staendig die halben Spalten leer.

-- Alle zwoelf Falten in einem Feld statt zwoelf Spalten: Die Liste ist eine
-- fachliche Einheit, und die Summe ist nur ueber alle zwoelf vergleichbar.
create table if not exists public.skinfolds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gemessen_am  date not null default current_date,
  falten       jsonb not null,
  created_at   timestamptz not null default now(),
  unique (user_id, gemessen_am)   -- eine Messung pro Tag; nochmal messen ueberschreibt
);
create index if not exists skinfolds_user_datum_idx on public.skinfolds(user_id, gemessen_am desc);

create table if not exists public.weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gemessen_am  date not null default current_date,
  kg           numeric(5,2) not null check (kg > 0 and kg < 500),
  created_at   timestamptz not null default now(),
  unique (user_id, gemessen_am)
);
create index if not exists weights_user_datum_idx on public.weights(user_id, gemessen_am desc);

-- Einstellungen fuer die Falten-Erinnerung. Gewicht wird bewusst nicht
-- angemahnt – taegliches Wiegen braucht keinen Wecker.
alter table public.profiles
  add column if not exists falten_intervall_wochen int not null default 2
    check (falten_intervall_wochen between 1 and 4),
  add column if not exists falten_erinnerung boolean not null default false,
  add column if not exists falten_uhrzeit time not null default '08:00',
  -- Zeitzone mitspeichern statt Europe/Berlin anzunehmen: pg_cron laeuft in UTC,
  -- und eine stille Annahme waere genau die Sorte Fehler, die spaeter niemand findet.
  add column if not exists zeitzone text not null default 'Europe/Berlin';

alter table public.skinfolds enable row level security;
alter table public.weights enable row level security;

drop policy if exists sf_all_own on public.skinfolds;
create policy sf_all_own on public.skinfolds
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists wt_all_own on public.weights;
create policy wt_all_own on public.weights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

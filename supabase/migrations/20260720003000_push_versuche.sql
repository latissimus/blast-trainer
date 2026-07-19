-- Protokoll der Push-Sendeversuche.
--
-- Warum eine Tabelle und nicht console.log: Die Konsolen-Ausgaben der Edge
-- Functions tauchen im Log-Werkzeug nicht auf, dort stehen nur Request-Zeilen.
-- Damit war Apples tatsaechliche Antwort von aussen unsichtbar – und genau die
-- entscheidet, ob ein Fehler beim Versand oder erst auf dem Geraet liegt.
--
-- Der Anlass: Ein Pausentimer, bei dem alles gruen aussah (Funktion 200, Abo
-- vorhanden, Erlaubnis erteilt) und trotzdem nie eine Mitteilung ankam.

create table if not exists public.push_versuche (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  at        timestamptz not null default now(),
  quelle    text,           -- welche Function
  endpunkt  text,           -- gekuerzt, nur zum Unterscheiden mehrerer Geraete
  status    int,            -- HTTP-Status von Apple
  antwort   text,           -- Rumpf bzw. Fehlermeldung
  ok        boolean not null default false
);

create index if not exists push_versuche_user_idx on public.push_versuche (user_id, at desc);

alter table public.push_versuche enable row level security;

drop policy if exists push_versuche_select_own on public.push_versuche;
create policy push_versuche_select_own on public.push_versuche
  for select using (user_id = auth.uid());

drop policy if exists push_versuche_insert_own on public.push_versuche;
create policy push_versuche_insert_own on public.push_versuche
  for insert with check (user_id = auth.uid());

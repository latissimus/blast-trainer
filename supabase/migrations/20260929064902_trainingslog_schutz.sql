-- Schutz gegen Datenverlust im Trainingslog.
--
-- Anlass: Am 29.09.2026 hat ein Geraet einen leeren Stand hochgeladen und
-- damit das komplette Log ueberschrieben. training_logs hatte nur eine Zeile
-- pro Nutzer und keinerlei Verlauf – ein einziger fehlerhafter Upload war
-- endgueltig. Beide Massnahmen hier greifen auf dem Server und damit
-- unabhaengig davon, welcher App-Pfad oder welches Geraet den Fehler macht.
--
-- 1) Verlauf: Vor jeder Aenderung wird der bisherige Stand gesichert – bei
--    Rueckgang der Satzanzahl immer, sonst hoechstens alle 30 Minuten.
-- 2) Sperre: Ab 6 Saetzen wird ein Upload abgelehnt, der mehr als die Haelfte
--    verliert (Leeren eingeschlossen) – ausser die App markiert ihn als
--    bewussten Phasenreset (meta.phasenReset mit neuerem Zeitstempel).
--    Unter 6 Saetzen keine Sperre: Ein falsch eingetragener erster Satz muss
--    sich loeschen lassen. Gesichert wird jeder Rueckgang trotzdem.
--
-- Bewusst KEIN Trigger fuer DELETE: Zeilen verschwinden nur beim Konto-
-- Loeschen (Kaskade von auth.users). Ein Insert in den Verlauf waehrend
-- dieser Kaskade wuerde am Fremdschluessel scheitern und das Loeschen
-- blockieren; ausserdem muessen die Daten dann wirklich weg sein.

begin;

create or replace function public.trainingslog_saetze(p jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select count(*)::int
  from jsonb_path_query(coalesce(p, '{}'::jsonb), 'lax $.data.*.*.*.sets[*][*]') s
  where coalesce(s ->> 'w', '') <> '' or coalesce(s ->> 'r', '') <> ''
$$;

create table if not exists public.training_logs_verlauf (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload      jsonb not null,
  saetze       integer not null,
  stand_vom    timestamptz,
  gesichert_am timestamptz not null default now(),
  anlass       text not null check (anlass in ('takt', 'rueckgang'))
);
create index if not exists training_logs_verlauf_user_zeit
  on public.training_logs_verlauf (user_id, gesichert_am desc);

alter table public.training_logs_verlauf enable row level security;
drop policy if exists verlauf_select_own on public.training_logs_verlauf;
create policy verlauf_select_own on public.training_logs_verlauf
  for select to authenticated
  using (user_id = auth.uid());
-- Keine Insert-/Update-/Delete-Regeln: Schreiben darf nur der Trigger.

create or replace function public.trainingslog_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saetze_alt integer;
  saetze_neu integer;
  bewusster_reset boolean;
  letzte_sicherung timestamptz;
begin
  if new.payload is not distinct from old.payload then
    return new;
  end if;

  saetze_alt := public.trainingslog_saetze(old.payload);
  saetze_neu := public.trainingslog_saetze(new.payload);
  -- Nur ein NEUERER Zeitstempel zaehlt als Reset. Ein veraltetes Geraet traegt
  -- oft einen aelteren phasenReset mit sich; "anders als auf dem Server"
  -- wuerde die Sperre genau fuer diesen Fall aushebeln. ISO-Zeitstempel aus
  -- toISOString() lassen sich als Text korrekt vergleichen. Das aeussere
  -- coalesce ist Pflicht: Ohne Zeitstempel ergibt der Vergleich NULL, und
  -- "not NULL" liesse die Sperre unten stillschweigend nicht greifen.
  bewusster_reset :=
    coalesce((new.payload #>> '{meta,phasenReset}') > coalesce(old.payload #>> '{meta,phasenReset}', ''), false);

  if saetze_alt >= 6
     and saetze_neu * 2 < saetze_alt
     and not bewusster_reset then
    raise exception using
      errcode = 'P0001',
      message = 'LOGMAN_SCHUTZ: Upload wuerde eingetragene Saetze entfernen',
      detail  = format('vorher %s Saetze, Upload %s Saetze', saetze_alt, saetze_neu),
      hint    = 'Serverstand laden und mit dem lokalen Stand zusammenfuehren.';
  end if;

  select max(gesichert_am) into letzte_sicherung
  from public.training_logs_verlauf
  where user_id = old.user_id;

  if saetze_neu < saetze_alt
     or letzte_sicherung is null
     or letzte_sicherung < now() - interval '30 minutes' then
    insert into public.training_logs_verlauf (user_id, payload, saetze, stand_vom, anlass)
    values (old.user_id, old.payload, saetze_alt, old.updated_at,
            case when saetze_neu < saetze_alt then 'rueckgang' else 'takt' end);
  end if;

  delete from public.training_logs_verlauf
  where user_id = old.user_id
    and gesichert_am < now() - interval '180 days';

  return new;
end;
$$;

revoke execute on function public.trainingslog_schuetzen() from public, anon, authenticated;

drop trigger if exists training_logs_schutz on public.training_logs;
create trigger training_logs_schutz
  before update on public.training_logs
  for each row execute function public.trainingslog_schuetzen();

commit;

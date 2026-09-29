-- Versionspruefung fuer das Trainingslog ("wer zuletzt speichert, gewinnt"
-- abschaffen) und Wiederherstellen frueherer Staende aus der App.
--
-- Das Log ist ein einziger Block pro Nutzer. Bisher ersetzte jeder Upload den
-- Serverstand blind – ein Geraet mit veraltetem Stand konnte so Saetze eines
-- anderen Geraets ueberschreiben. Jetzt:
--
-- * version zaehlt bei JEDER inhaltlichen Aenderung hoch (Trigger), egal wer
--   schreibt – auch ein noch nicht aktualisiertes App-Geraet.
-- * training_log_speichern(payload, basis) nimmt einen Stand nur an, wenn er
--   auf der aktuellen Version aufbaut. Sonst antwortet es mit "konflikt" und
--   dem Serverstand; die App fuehrt zusammen und versucht es erneut.
-- * training_log_wiederherstellen(verlauf_id) holt einen gesicherten Stand
--   zurueck und sichert vorher IMMER den aktuellen (auch innerhalb des
--   30-Minuten-Takts), damit ein versehentliches Zurueckholen umkehrbar bleibt.

begin;

alter table public.training_logs
  add column if not exists version bigint not null default 1;

create or replace function public.training_logs_version_hochzaehlen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version := case
    when new.payload is distinct from old.payload then old.version + 1
    else old.version
  end;
  return new;
end;
$$;

drop trigger if exists training_logs_version on public.training_logs;
create trigger training_logs_version
  before update on public.training_logs
  for each row execute function public.training_logs_version_hochzaehlen();

alter table public.training_logs_verlauf
  drop constraint if exists training_logs_verlauf_anlass_check;
alter table public.training_logs_verlauf
  add constraint training_logs_verlauf_anlass_check
  check (anlass in ('takt', 'rueckgang', 'vor_wiederherstellung'));

create or replace function public.training_log_speichern(p_payload jsonb, p_basis bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aktuell public.training_logs%rowtype;
  neue_version bigint;
begin
  if uid is null then
    raise exception using errcode = '28000', message = 'LOGMAN_ANMELDUNG: Nicht angemeldet';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'LOGMAN_UNGUELTIG: Kein gueltiger Trainingsstand';
  end if;

  select * into aktuell from public.training_logs where user_id = uid for update;

  if not found then
    insert into public.training_logs (user_id, payload, updated_at)
    values (uid, p_payload, now())
    returning version into neue_version;
    return jsonb_build_object('status', 'ok', 'version', neue_version);
  end if;

  if p_basis is distinct from aktuell.version then
    return jsonb_build_object('status', 'konflikt', 'version', aktuell.version, 'payload', aktuell.payload);
  end if;

  update public.training_logs
     set payload = p_payload, updated_at = now()
   where user_id = uid
  returning version into neue_version;
  return jsonb_build_object('status', 'ok', 'version', neue_version);
end;
$$;

create or replace function public.training_log_wiederherstellen(p_verlauf_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gesichert jsonb;
  aktuell public.training_logs%rowtype;
  neu jsonb;
  neue_version bigint;
begin
  if uid is null then
    raise exception using errcode = '28000', message = 'LOGMAN_ANMELDUNG: Nicht angemeldet';
  end if;

  select payload into gesichert
  from public.training_logs_verlauf
  where id = p_verlauf_id and user_id = uid;
  if gesichert is null then
    raise exception using errcode = 'P0002', message = 'LOGMAN_VERLAUF: Gesicherter Stand nicht gefunden';
  end if;

  -- Neuer phasenReset-Zeitstempel: Das Zurueckholen ist eine bewusste
  -- Entscheidung und darf deshalb auch deutlich weniger Saetze enthalten.
  neu := jsonb_set(gesichert, '{meta}',
    coalesce(gesichert -> 'meta', '{}'::jsonb)
    || jsonb_build_object('phasenReset', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));

  select * into aktuell from public.training_logs where user_id = uid for update;
  if found then
    insert into public.training_logs_verlauf (user_id, payload, saetze, stand_vom, anlass)
    values (uid, aktuell.payload, public.trainingslog_saetze(aktuell.payload), aktuell.updated_at, 'vor_wiederherstellung');
    update public.training_logs
       set payload = neu, updated_at = now()
     where user_id = uid
    returning version into neue_version;
  else
    insert into public.training_logs (user_id, payload, updated_at)
    values (uid, neu, now())
    returning version into neue_version;
  end if;

  return jsonb_build_object('status', 'ok', 'version', neue_version, 'payload', neu);
end;
$$;

revoke execute on function public.training_log_speichern(jsonb, bigint) from public, anon;
revoke execute on function public.training_log_wiederherstellen(bigint) from public, anon;
grant execute on function public.training_log_speichern(jsonb, bigint) to authenticated;
grant execute on function public.training_log_wiederherstellen(bigint) to authenticated;
revoke execute on function public.training_logs_version_hochzaehlen() from public, anon, authenticated;

commit;

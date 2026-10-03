-- CAPBOY-Kopplung: CAPBOY darf das Trainingslog eines Kontos LESEN, nie schreiben.
--
-- Anlass: CAPBOY (Ernährung, Schlaf, Körperwerte) soll jeden Abend die
-- LOGMAN-Einheiten mit auswerten. Bisher ging das nur über einen JSON-Export,
-- den man von Hand in CAPBOY einspielte. Jetzt koppelt man beide Apps einmal:
--
--   1. LOGMAN, Profil → „Mit CAPBOY verbinden“: capboy_code_erstellen() liefert
--      einen Code, der 10 Minuten gilt.
--   2. CAPBOY, Profil → Code eingeben: CAPBOYs Server ruft
--      capboy_code_einloesen() auf und bekommt EINMALIG einen langen Lese-Token.
--   3. Danach liest CAPBOY mit capboy_training_log(token) genau dieses eine Log.
--
-- Warum kein Hauptschluessel in CAPBOY: Damit koennte CAPBOY technisch auch
-- schreiben. Nach dem Datenverlust vom 29.09.2026 darf in das Log nur noch
-- training_log_speichern() mit Versionspruefung schreiben – das bleibt so.
-- Der Token kann nichts ausser lesen.
--
-- Je Konto: Jede Kopplung gehoert zu einem LOGMAN-Konto und liefert nur dessen
-- Log. So kann spaeter jede Person ihr eigenes CAPBOY mit ihrem eigenen LOGMAN
-- verbinden.
--
-- Codes und Tokens liegen nur als SHA-256-Hash in der Datenbank. Die Tabellen
-- haben keine RLS-Regeln: Zugriff gibt es ausschliesslich ueber die Funktionen.
-- Konto loeschen raeumt per Kaskade mit auf.

begin;

create table if not exists public.capboy_kopplungen (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  token_hash         text not null unique,
  erstellt_am        timestamptz not null default now(),
  zuletzt_gelesen_am timestamptz,
  getrennt_am        timestamptz
);
create index if not exists capboy_kopplungen_user
  on public.capboy_kopplungen (user_id);
alter table public.capboy_kopplungen enable row level security;

create table if not exists public.capboy_kopplungscodes (
  code_hash   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  gueltig_bis timestamptz not null
);
alter table public.capboy_kopplungscodes enable row level security;

-- Codes ohne verwechselbare Zeichen (kein I, O, 0, 1). 32 Zeichen, 10 Stellen
-- = 50 Bit; bei 10 Minuten Gueltigkeit nicht zu erraten.
create or replace function public.capboy_hash(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

create or replace function public.capboy_code_normalisieren(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.capboy_code_erstellen()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  zufall bytea := extensions.gen_random_bytes(10);
  code text := '';
  bis timestamptz := now() + interval '10 minutes';
begin
  if uid is null then
    raise exception using errcode = '28000', message = 'LOGMAN_ANMELDUNG: Nicht angemeldet';
  end if;
  for i in 0..9 loop
    code := code || substr(zeichen, (get_byte(zufall, i) % 32) + 1, 1);
  end loop;
  -- Pro Konto gilt immer nur der neueste Code.
  delete from public.capboy_kopplungscodes where user_id = uid or gueltig_bis < now();
  insert into public.capboy_kopplungscodes (code_hash, user_id, gueltig_bis)
  values (public.capboy_hash(code), uid, bis);
  return jsonb_build_object('code', substr(code, 1, 5) || '-' || substr(code, 6, 5), 'gueltig_bis', bis);
end;
$$;

-- Aufgerufen von CAPBOYs Server (anonym). Verbraucht den Code und gibt den
-- Lese-Token genau einmal heraus.
create or replace function public.capboy_code_einloesen(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eintrag public.capboy_kopplungscodes%rowtype;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from public.capboy_kopplungscodes
   where code_hash = public.capboy_hash(public.capboy_code_normalisieren(p_code))
  returning * into eintrag;
  if eintrag.user_id is null or eintrag.gueltig_bis < now() then
    raise exception using errcode = 'P0002', message = 'LOGMAN_KOPPLUNG: Code ungueltig oder abgelaufen';
  end if;
  -- Eine neue Kopplung ersetzt die alte: Ein alter Token (etwa von einem
  -- geloeschten CAPBOY-Konto) soll nicht weiter lesen koennen.
  update public.capboy_kopplungen
     set getrennt_am = now()
   where user_id = eintrag.user_id and getrennt_am is null;
  insert into public.capboy_kopplungen (user_id, token_hash)
  values (eintrag.user_id, public.capboy_hash(token));
  return jsonb_build_object('token', token);
end;
$$;

-- Aufgerufen von CAPBOYs Server (anonym). Liest NUR. Mit p_bekannte_version
-- antwortet die Funktion ohne Payload, wenn sich nichts geaendert hat – das
-- haelt die taeglichen Abgleiche klein.
create or replace function public.capboy_training_log(p_token text, p_bekannte_version bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kopplung public.capboy_kopplungen%rowtype;
  stand public.training_logs%rowtype;
begin
  select * into kopplung
    from public.capboy_kopplungen
   where token_hash = public.capboy_hash(coalesce(p_token, ''))
     and getrennt_am is null;
  if not found then
    raise exception using errcode = '28000', message = 'LOGMAN_KOPPLUNG: Nicht verbunden';
  end if;
  update public.capboy_kopplungen set zuletzt_gelesen_am = now() where id = kopplung.id;

  select * into stand from public.training_logs where user_id = kopplung.user_id;
  if not found then
    return jsonb_build_object('status', 'leer');
  end if;
  if p_bekannte_version is not null and p_bekannte_version = stand.version then
    return jsonb_build_object('status', 'unveraendert', 'version', stand.version);
  end if;
  return jsonb_build_object('status', 'ok', 'version', stand.version, 'updated_at', stand.updated_at, 'payload', stand.payload);
end;
$$;

-- Trennen aus CAPBOY heraus (anonym, nur mit dem eigenen Token).
create or replace function public.capboy_token_trennen(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.capboy_kopplungen
     set getrennt_am = now()
   where token_hash = public.capboy_hash(coalesce(p_token, ''))
     and getrennt_am is null
$$;

-- Fuer den Profilbereich in LOGMAN (angemeldet).
create or replace function public.capboy_kopplung_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  kopplung public.capboy_kopplungen%rowtype;
begin
  if uid is null then
    raise exception using errcode = '28000', message = 'LOGMAN_ANMELDUNG: Nicht angemeldet';
  end if;
  select * into kopplung
    from public.capboy_kopplungen
   where user_id = uid and getrennt_am is null
   order by erstellt_am desc
   limit 1;
  if not found then
    return jsonb_build_object('verbunden', false);
  end if;
  return jsonb_build_object('verbunden', true, 'seit', kopplung.erstellt_am, 'zuletzt_gelesen_am', kopplung.zuletzt_gelesen_am);
end;
$$;

create or replace function public.capboy_kopplung_trennen()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '28000', message = 'LOGMAN_ANMELDUNG: Nicht angemeldet';
  end if;
  update public.capboy_kopplungen set getrennt_am = now() where user_id = uid and getrennt_am is null;
  delete from public.capboy_kopplungscodes where user_id = uid;
end;
$$;

revoke all on table public.capboy_kopplungen, public.capboy_kopplungscodes from anon, authenticated;
revoke execute on function public.capboy_hash(text), public.capboy_code_normalisieren(text) from public, anon, authenticated;
revoke execute on function
  public.capboy_code_erstellen(),
  public.capboy_code_einloesen(text),
  public.capboy_training_log(text, bigint),
  public.capboy_token_trennen(text),
  public.capboy_kopplung_status(),
  public.capboy_kopplung_trennen()
from public;
grant execute on function public.capboy_code_erstellen(), public.capboy_kopplung_status(), public.capboy_kopplung_trennen() to authenticated;
grant execute on function public.capboy_code_einloesen(text), public.capboy_training_log(text, bigint), public.capboy_token_trennen(text) to anon, authenticated;

commit;

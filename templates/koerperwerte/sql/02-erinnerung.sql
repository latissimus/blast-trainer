-- HINWEIS: Projekt-URL und Publishable-Key unten sind Platzhalter.
-- Vor dem Ausfuehren durch die Werte der Ziel-App ersetzen.

-- Wecker fuer die Hautfalten-Messung.
--
-- Nur die Falten werden angemahnt, nicht das Gewicht: Wiegen ist eine taegliche
-- Gewohnheit, die keine Einladung braucht. Die Faltenmessung hat einen Termin.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Wann zuletzt erinnert wurde. Ohne diese Spalte kaeme die Push ab dem
-- Faelligkeitstag JEDEN Tag wieder, bis gemessen wird.
alter table public.profiles add column if not exists falten_erinnert_am date;

-- Wer ist dran? Bewusst in SQL statt in der Edge Function: Die Frage ist
-- Datenlogik und laesst sich hier direkt nachpruefen (siehe unten).
--
-- security definer, weil der Wecker ueber ALLE Nutzer laeuft – das ist genau die
-- Stelle, an der RLS sonst (richtigerweise) im Weg staende.
create or replace function public.falten_faellige_abos()
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public, pg_temp
as $$
  with kandidat as (
    select p.id,
           -- Ortszeit des Nutzers. "8 Uhr" heisst je nach Zeitzone etwas anderes,
           -- der Wecker tickt aber in UTC.
           (now() at time zone coalesce(p.zeitzone, 'Europe/Berlin')) as jetzt_lokal,
           coalesce(p.falten_uhrzeit, '08:00') as soll,
           coalesce(p.falten_intervall_wochen, 2) * 7 as tage,
           p.falten_erinnert_am,
           (select max(s.gemessen_am) from skinfolds s where s.user_id = p.id) as zuletzt
    from profiles p
    where p.falten_erinnerung is true
  )
  select k.id, ps.endpoint, ps.p256dh, ps.auth
  from kandidat k
  join push_subscriptions ps on ps.user_id = k.id
  where
    -- Zeitfenster: feuert im 15-Minuten-Takt frueheStens zur eingestellten Zeit,
    -- nie davor. Lieber ein paar Minuten zu spaet als zu frueh.
        k.jetzt_lokal::time >= k.soll
    and k.jetzt_lokal::time <  k.soll + interval '15 minutes'
    -- Faellig: noch nie gemessen, oder das Intervall ist um.
    and (k.zuletzt is null or k.jetzt_lokal::date - k.zuletzt >= k.tage)
    -- Und seit der letzten Mahnung ist auch ein volles Intervall vergangen.
    and (k.falten_erinnert_am is null or k.jetzt_lokal::date - k.falten_erinnert_am >= k.tage);
$$;

-- Erst nach erfolgreichem Versand setzen. Andersherum haette ein Fehler beim
-- Senden die Erinnerung fuer ein ganzes Intervall verschluckt.
create or replace function public.falten_erinnert_markieren(ids uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update profiles p
     set falten_erinnert_am = (now() at time zone coalesce(p.zeitzone, 'Europe/Berlin'))::date
   where p.id = any(ids);
$$;

-- Nur der Server ruft das auf, nicht der Browser.
revoke all on function public.falten_faellige_abos() from public, anon, authenticated;
revoke all on function public.falten_erinnert_markieren(uuid[]) from public, anon, authenticated;
grant execute on function public.falten_faellige_abos() to service_role;
grant execute on function public.falten_erinnert_markieren(uuid[]) to service_role;
-- Der Legacy-service_role-Key ist fuer dieses Projekt ungueltig (es nutzt das
-- neue sb_secret_-Format). Er liegt hier nutzlos herum – weg damit.
delete from vault.secrets where name = 'service_role_key';

-- Stattdessen ein eigenes Token, hier gewuerfelt. Es verlaesst die Datenbank nur
-- Richtung Function und steht in keiner Datei und in keinem Job-Text.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
  'wecker_token', 'Damit nur der Cron den Falten-Wecker ausloesen kann');

-- Die Function fragt hierueber nach, ob ein Token echt ist. Sie bekommt den Wert
-- nie zu sehen – nur ja oder nein.
create or replace function public.wecker_token_gueltig(t text)
returns boolean
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'wecker_token' and decrypted_secret = t
  );
$$;

revoke all on function public.wecker_token_gueltig(text) from public, anon, authenticated;
grant execute on function public.wecker_token_gueltig(text) to service_role;
-- Neu aufsetzen: publishable Key fuers Gateway (der ist oeffentlich, das ist in
-- Ordnung), das Wecker-Token als eigentlicher Ausweis. Beides aus dem Vault bzw.
-- als Konstante – der alte Job trug einen ungueltigen Legacy-JWT.
select cron.unschedule('faltenwecker');

select cron.schedule(
  'faltenwecker',
  '0,15,30,45 * * * *',
  $$
  select net.http_post(
    url     := 'https://DEIN-PROJEKT.supabase.co/functions/v1/faltenwecker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN_PUBLISHABLE_KEY',
      'X-Wecker-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'wecker_token')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

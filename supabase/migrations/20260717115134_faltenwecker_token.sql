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

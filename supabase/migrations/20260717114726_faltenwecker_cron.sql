-- Der Anstoss fuer den Falten-Wecker.
--
-- Viertelstuendlich statt stuendlich: Die Uhrzeit ist frei einstellbar (08:07 ist
-- erlaubt), und die Function feuert nur im 15-Minuten-Fenster ab der Sollzeit.
-- Bei einem Stundentakt haetten alle Zeiten ausser der vollen Stunde nie gefeuert.
--
-- Die Function selbst entscheidet, ob ueberhaupt jemand dran ist. Die allermeisten
-- Laeufe tun nichts – das ist der Preis dafuer, dass wir keinen Termin verpassen.
--
-- HINWEIS: Dieser erste Anlauf trug einen Legacy-service_role-Key, der fuer dieses
-- Projekt ungueltig ist (es nutzt das neue sb_secret_-Format). Die Migration
-- faltenwecker_cron_v2 setzt den Job neu auf. Hier belassen fuer den Verlauf.
select cron.schedule(
  'faltenwecker',
  '0,15,30,45 * * * *',
  $$
  select net.http_post(
    url     := 'https://bjtnpmselziqpwnthukj.supabase.co/functions/v1/faltenwecker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

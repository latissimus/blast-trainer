-- Neu aufsetzen: publishable Key fuers Gateway (der ist oeffentlich, das ist in
-- Ordnung), das Wecker-Token als eigentlicher Ausweis. Beides aus dem Vault bzw.
-- als Konstante – der alte Job trug einen ungueltigen Legacy-JWT.
select cron.unschedule('faltenwecker');

select cron.schedule(
  'faltenwecker',
  '0,15,30,45 * * * *',
  $$
  select net.http_post(
    url     := 'https://bjtnpmselziqpwnthukj.supabase.co/functions/v1/faltenwecker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_wPAzLdRgAvy46B5KMNuyCQ_-KGAbm5T',
      'X-Wecker-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'wecker_token')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

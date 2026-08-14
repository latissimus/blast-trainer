-- Die nicht mehr verwendete Hautfaltenmessung restlos aus dem produktiven
-- Backend entfernen. Gewichtsdaten bleiben bewusst unangetastet.

begin;

-- Den Wecker zuerst stilllegen. Die Schleife funktioniert auch dann, wenn aus
-- einem frueheren Rollout versehentlich mehr als ein gleichnamiger Job besteht.
do $$
declare
  job record;
begin
  for job in select jobid from cron.job where jobname = 'faltenwecker'
  loop
    perform cron.unschedule(job.jobid);
  end loop;
exception
  when undefined_table or invalid_schema_name then null;
end;
$$;

drop function if exists public.falten_faellige_abos();
drop function if exists public.falten_erinnert_markieren(uuid[]);
drop function if exists public.wecker_token_gueltig(text);

-- Das Token hatte ausschliesslich den Zweck, den inzwischen entfernten
-- Cron-Aufruf an der Edge Function auszuweisen.
delete from vault.secrets where name = 'wecker_token';

-- Auch Diagnosezeilen dieses Weckers enthalten keinen verbleibenden Zweck.
delete from public.push_versuche where quelle = 'faltenwecker';

drop table if exists public.skinfolds cascade;

alter table public.profiles
  drop column if exists falten_intervall_wochen,
  drop column if exists falten_erinnerung,
  drop column if exists falten_uhrzeit,
  drop column if exists falten_erinnert_am,
  drop column if exists zeitzone;

commit;

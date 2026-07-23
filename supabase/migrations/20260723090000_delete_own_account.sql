-- Nutzer koennen ihren eigenen Account samt kaskadierenden App-Daten loeschen.
-- Storage-Bilder werden vorher im Client entfernt, weil storage.objects nicht
-- per Fremdschluessel an auth.users haengt.

create or replace function public.delete_own_account(nur_pruefen boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  eigene_id uuid := auth.uid();
begin
  if eigene_id is null then
    raise exception 'Nicht angemeldet';
  end if;

  if nur_pruefen then
    return true;
  end if;

  delete from auth.users where id = eigene_id;
  return true;
end;
$$;

revoke all on function public.delete_own_account(boolean) from public, anon;
grant execute on function public.delete_own_account(boolean) to authenticated;

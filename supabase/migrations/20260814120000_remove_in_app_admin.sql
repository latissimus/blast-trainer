-- LOGMAN hat keine administrative Rolle innerhalb der Kunden-App mehr.
-- Projektverantwortliche bearbeiten Feedback ausschliesslich ueber den
-- geschuetzten Supabase-Zugang. App-Konten sehen nur ihre eigenen Daten.

begin;

-- Die bisherige Admin-Testhistorie darf laut Produktentscheidung weg. Die
-- Auth-/Profilzeile bleibt bestehen und wird nach der Migration zu einem ganz
-- normalen Kundenkonto. Notizbuch und eingesandtes Feedback bleiben erhalten.
create temporary table ehemalige_logman_admins on commit drop as
  select id from public.profiles where role = 'admin';

delete from public.training_logs
where user_id in (select id from ehemalige_logman_admins);

-- Alle Regeln ersetzen, die is_admin() aufrufen, bevor die Hilfsfunktion und
-- die Rollenspalte entfernt werden.
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists logs_select_own_or_admin on public.training_logs;
drop policy if exists logs_select_own on public.training_logs;
create policy logs_select_own on public.training_logs
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists logs_update_own_or_admin on public.training_logs;
drop policy if exists logs_update_own on public.training_logs;
create policy logs_update_own on public.training_logs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists subs_select_own_or_admin on public.push_subscriptions;
drop policy if exists subs_select_own on public.push_subscriptions;
create policy subs_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists feedback_select_own_or_admin on public.feedback;
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists feedback_update_admin on public.feedback;

-- Neue Profile kennen keine Rolle mehr.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- updated_at weiter automatisch pflegen, ohne eine Rollenpruefung zu behalten.
drop trigger if exists profiles_guard on public.profiles;
drop function if exists public.prevent_role_escalation();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_profile_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

drop function if exists public.is_admin();
alter table public.profiles drop column role;

commit;

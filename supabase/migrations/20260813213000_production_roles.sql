-- Neue Konten bekommen nie allein wegen einer oeffentlich bekannten
-- E-Mail-Adresse Adminrechte. Bestehende Adminprofile bleiben unveraendert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'customer',
    nullif(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Angemeldete Kunden duerfen ihre Rolle weiterhin niemals anheben. Eine
-- bewusste administrative SQL-Aenderung (auth.uid() ist dort null) bleibt
-- moeglich, damit der erste Admin ohne E-Mail-Hintertuer eingerichtet wird.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Drop broad listing policy: public bucket serves object URLs without it
drop policy if exists avatars_public_read on storage.objects;

-- Trigger functions never need EXECUTE granted to callers -> remove RPC exposure
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.prevent_role_escalation() from public, anon, authenticated;

-- is_admin() is only used inside RLS policies for authenticated users
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

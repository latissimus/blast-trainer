-- Kundenfeedback direkt aus der App. Nutzer dürfen nur unter ihrer eigenen
-- ID schreiben und lesen; Administratoren sehen den gesamten Eingang.

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kategorie   text not null check (kategorie in ('idee', 'fehler', 'verstaendlichkeit')),
  nachricht   text not null check (char_length(nachricht) between 10 and 2000),
  status      text not null default 'neu' check (status in ('neu', 'gelesen', 'erledigt')),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'neu');

drop policy if exists feedback_select_own_or_admin on public.feedback;
create policy feedback_select_own_or_admin on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

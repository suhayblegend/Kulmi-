-- =============================================================
--  KULMI migration v42 — push notification device tokens. Idempotent.
--  Each member's device(s) register an FCM token so the Edge function can send
--  native push on invitations and matches (alongside the emails).
-- =============================================================

create table if not exists public.device_tokens (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "Manage own device tokens" on public.device_tokens;
create policy "Manage own device tokens" on public.device_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';

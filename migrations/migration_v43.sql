-- =============================================================
--  KULMI migration v43 — invitations expire after 7 days. Idempotent.
--  Pairs with the 48h ice-breaker: respond within 7 days -> speak within 48h.
--  Expiry frees the sender's open-introduction slot; nobody is shamed.
-- =============================================================

alter table public.invitations add column if not exists expires_at timestamptz;
alter table public.invitations add column if not exists expiry_warned boolean not null default false;

-- Allow the new status value.
alter table public.invitations drop constraint if exists invitations_status_check;
alter table public.invitations add constraint invitations_status_check
  check (status in ('pending','accepted','declined','expired'));

-- New invitations get a 7-day window automatically.
alter table public.invitations alter column expires_at set default (now() + interval '7 days');

-- Backfill: existing pending invitations get a fresh 7 days from now (never
-- expire anything retroactively).
update public.invitations set expires_at = now() + interval '7 days'
  where status = 'pending' and expires_at is null;

-- Sweep — any authenticated load may call this (same pattern as chats).
create or replace function public.expire_stale_invitations()
returns void language sql security definer set search_path = public as $$
  update public.invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
$$;
grant execute on function public.expire_stale_invitations() to authenticated;

notify pgrst, 'reload schema';

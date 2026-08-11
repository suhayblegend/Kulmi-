-- =============================================================
--  KULMI migration v11 — "Stop contact" (dignified alternative to
--  dating-app "block") + tighter invitation transitions. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- H4: let a member quietly prevent further contact from someone.
--     Framed in the app as "End & stop contact", not "block".
-- -------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

drop policy if exists "Manage own blocks" on public.blocks;
create policy "Manage own blocks" on public.blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

-- Admins can see blocks (for safety review).
drop policy if exists "Admins view blocks" on public.blocks;
create policy "Admins view blocks" on public.blocks for select to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------
-- No invitations may cross a "stop contact" in EITHER direction,
-- and the sender must be verified (carried over from v10).
-- -------------------------------------------------------------
drop policy if exists "Send invitations" on public.invitations;
create policy "Send invitations" on public.invitations for insert to authenticated
  with check (
    auth.uid() = sender_id
    and (public.is_verified() or public.is_admin())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = receiver_id and b.blocked_id = sender_id)
         or (b.blocker_id = sender_id and b.blocked_id = receiver_id)
    )
  );

-- -------------------------------------------------------------
-- L5: a receiver may only accept/decline a still-PENDING invite
--     (no re-opening an accepted/declined one).
-- -------------------------------------------------------------
drop policy if exists "Respond to invitations" on public.invitations;
create policy "Respond to invitations" on public.invitations for update to authenticated
  using (auth.uid() = receiver_id and status = 'pending')
  with check (auth.uid() = receiver_id and status in ('accepted', 'declined'));

notify pgrst, 'reload schema';

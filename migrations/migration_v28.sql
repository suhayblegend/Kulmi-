-- =============================================================
--  KULMI migration v28 — security-audit hardening. Idempotent.
--  M1 enforce open-introductions cap in the DB (was client-only) ·
--  L4 WITH CHECK on own-profile update.
-- =============================================================

-- -------------------------------------------------------------
-- M1: the "3 free / 5 Kulmi+ open introductions" limit was only enforced in
-- the React client — a member could bypass it by inserting invitations via the
-- API, defeating the paid perk and the anti-spam intent. Enforce server-side.
-- -------------------------------------------------------------
create or replace function public.enforce_invite_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  open_count int;
  cap int;
begin
  if new.status is distinct from 'pending' then
    return new; -- only brand-new outgoing invitations count toward the cap
  end if;
  select count(*) into open_count from (
    select id from public.invitations where sender_id = new.sender_id and status = 'pending'
    union all
    select id from public.sessions where status = 'active'
      and (user1_id = new.sender_id or user2_id = new.sender_id)
  ) t;
  cap := case when public.is_premium(new.sender_id) then 5 else 3 end;
  if open_count >= cap then
    raise exception 'You can have % open introductions at a time. Finish or end one first.', cap;
  end if;
  return new;
end $$;
drop trigger if exists trg_enforce_invite_cap on public.invitations;
create trigger trg_enforce_invite_cap before insert on public.invitations
  for each row execute function public.enforce_invite_cap();

-- -------------------------------------------------------------
-- L4: own-profile UPDATE policy had USING but no WITH CHECK. Privileged columns
-- are already pinned by guard_profile_privileges, but add the check as
-- defense-in-depth so a row can never be updated to a different owner's id.
-- -------------------------------------------------------------
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

notify pgrst, 'reload schema';

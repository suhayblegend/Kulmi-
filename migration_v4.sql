-- =============================================================
--  KULMI migration v4 — SECURITY HARDENING (audit fixes)
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--  Fixes: self-promote-to-admin, DM-anyone bypass, wali PII leak, match race.
-- =============================================================

-- -------------------------------------------------------------
-- C1: block privilege escalation on INSERT (the guard was UPDATE-only, so a
--     user could insert their own profile row with role='admin' / verified).
--     Now non-admins can never set role / verification on insert or update.
--     (auth.uid() IS NULL = trusted server / SQL editor → not restricted, so
--      the manual "make me admin" UPDATE below still works.)
-- -------------------------------------------------------------
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- service role / SQL editor
  if public.is_admin() then return new; end if;    -- admins may set anything
  if TG_OP = 'INSERT' then
    new.role := 'user';
    new.photo_verified := false;
    new.verification_status := 'unverified';
  else
    new.role := old.role;
    new.photo_verified := old.photo_verified;
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      new.verification_status := old.verification_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- -------------------------------------------------------------
-- C2: only the mutual-"yes" trigger may create chats. The original permissive
--     "any participant can insert a chat" policy let a user force a DM with
--     anyone, skipping the whole invitation/session/consent flow.
-- -------------------------------------------------------------
drop policy if exists "Users can create chats." on public.chats;

-- -------------------------------------------------------------
-- H1: a Wali could read a ward's FULL profile row (email, wali_email,
--     verification selfie, private deal-breakers). Remove wali from the base
--     table SELECT and expose only SAFE ward columns via a definer function.
-- -------------------------------------------------------------
drop policy if exists "Profiles readable by owner, admin, wali" on public.profiles;
drop policy if exists "Profiles readable by owner or admin" on public.profiles;
create policy "Profiles readable by owner or admin"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin());

create or replace function public.get_my_wards()
returns setof public.public_profiles
language sql stable security definer set search_path = public as $$
  select pp.*
  from public.public_profiles pp
  join public.profiles p on p.id = pp.id
  where p.wali_email is not null
    and lower(p.wali_email) = lower(public.my_email());
$$;
grant execute on function public.get_my_wards() to authenticated;
-- (Wali still reads wards' chats/sessions/messages via the is_ward policies —
--  those carry no profile PII.)

-- -------------------------------------------------------------
-- H2: serialize the mutual-"yes" so two near-simultaneous "yes" votes always
--     create the chat (advisory lock → the 2nd vote sees the 1st, committed).
-- -------------------------------------------------------------
create or replace function public.handle_session_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  yes_count int;
begin
  perform pg_advisory_xact_lock(hashtext(new.session_id::text));
  select * into s from public.sessions where id = new.session_id;
  if s.id is null then return new; end if;

  if new.decision = 'no' then
    update public.sessions set status = 'ended' where id = s.id and status = 'active';
    return new;
  end if;

  select count(*) into yes_count from public.session_decisions
    where session_id = s.id and decision = 'yes' and user_id in (s.user1_id, s.user2_id);

  if yes_count >= 2 then
    if not exists (
      select 1 from public.chats
      where least(user1_id, user2_id) = s.user1_id and greatest(user1_id, user2_id) = s.user2_id
    ) then
      insert into public.chats (user1_id, user2_id) values (s.user1_id, s.user2_id);
    end if;
    update public.sessions set status = 'completed' where id = s.id;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

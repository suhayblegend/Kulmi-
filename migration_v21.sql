-- =============================================================
--  KULMI migration v21 — production-audit security fixes. Idempotent.
--  C2 invitation consent bypass · H1 email spoof / wali snooping ·
--  H2 ban + preserve moderation history · H4 private intros ·
--  M2 report constraints · M4 status race · M5 row re-pointing.
-- =============================================================

-- -------------------------------------------------------------
-- C2: a receiver could rewrite sender_id on an invitation and force a
-- session with any user (consent bypass). Lock updates to `status` only,
-- and pin the pair with a trigger (belt and braces).
-- -------------------------------------------------------------
revoke update on public.invitations from authenticated;
grant update (status) on public.invitations to authenticated;

create or replace function public.pin_invitation_pair()
returns trigger language plpgsql as $$
begin
  new.sender_id := old.sender_id;
  new.receiver_id := old.receiver_id;
  return new;
end $$;
drop trigger if exists trg_pin_invitation_pair on public.invitations;
create trigger trg_pin_invitation_pair before update on public.invitations
  for each row execute function public.pin_invitation_pair();

-- -------------------------------------------------------------
-- H1: a user could set profiles.email to someone's wali_email and read their
-- private chats (my_email/is_ward trusted the profile column). Fix both ends:
-- my_email() now trusts ONLY the verified login email from the JWT, and the
-- guard trigger pins profiles.email for non-admins.
-- -------------------------------------------------------------
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select auth.jwt() ->> 'email';
$$;

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- server / SQL editor: allow
  if public.is_admin() then return new; end if;    -- admins: allow anything
  -- everyone else: cannot change privileged fields
  if tg_op = 'UPDATE' then
    new.email := old.email;                        -- email is identity: pinned
    new.role := coalesce(old.role, 'user');
    new.photo_verified := coalesce(old.photo_verified, false);
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      new.verification_status := old.verification_status;
    end if;
  else
    new.email := coalesce(auth.jwt() ->> 'email', new.email); -- insert: your real login email
    new.role := 'user';
    new.photo_verified := false;
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;
  return new;
end $$;

-- -------------------------------------------------------------
-- H2a: deleting a user must NOT erase reports about them (moderation trail).
-- -------------------------------------------------------------
alter table public.reports alter column reporter_id drop not null;
alter table public.reports alter column reported_id drop not null;
do $$ begin
  alter table public.reports drop constraint if exists reports_reporter_id_fkey;
  alter table public.reports add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.profiles(id) on delete set null;
  alter table public.reports drop constraint if exists reports_reported_id_fkey;
  alter table public.reports add constraint reports_reported_id_fkey
    foreign key (reported_id) references public.profiles(id) on delete set null;
exception when others then null; end $$;

-- -------------------------------------------------------------
-- H2b: real ban — a banned email cannot create a profile again.
-- (Rows are written by the admin Edge function with the ban reason.)
-- -------------------------------------------------------------
create table if not exists public.banned_emails (
  email      text primary key,
  reason     text,
  banned_at  timestamptz not null default now()
);
alter table public.banned_emails enable row level security;
drop policy if exists "Admins read bans" on public.banned_emails;
create policy "Admins read bans" on public.banned_emails for select to authenticated
  using (public.is_admin());

create or replace function public.block_banned_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and exists (
    select 1 from public.banned_emails b where lower(b.email) = lower(new.email)
  ) then
    raise exception 'This account has been removed from Kulmi and cannot be re-registered.';
  end if;
  return new;
end $$;
drop trigger if exists trg_block_banned on public.profiles;
create trigger trg_block_banned before insert on public.profiles
  for each row execute function public.block_banned_signup();

-- -------------------------------------------------------------
-- H4: voice intros move to the PRIVATE bucket (category 'intro').
-- Readable by: owner, admins, a match — or anyone signed-in IF the owner set
-- their intro to public. (Old public-URL intros keep working via passthrough.)
-- -------------------------------------------------------------
drop policy if exists "Secure read gated" on storage.objects;
create policy "Secure read gated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'secure' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or (
        (storage.foldername(name))[2] in ('gallery', 'voice')
        and exists (select 1 from public.chats c
          where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
             or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'answer'
        and exists (select 1 from public.sessions s
          where (s.user1_id = auth.uid() and s.user2_id = ((storage.foldername(name))[1])::uuid)
             or (s.user2_id = auth.uid() and s.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'intro'
        and (
          exists (select 1 from public.profiles p
            where p.id = ((storage.foldername(name))[1])::uuid and p.intro_public = true)
          or exists (select 1 from public.chats c
            where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
               or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
        )
      )
    )
  );

-- -------------------------------------------------------------
-- M2: report hygiene — sane length, one open report per pair.
-- -------------------------------------------------------------
do $$ begin
  alter table public.reports add constraint reports_reason_len
    check (char_length(reason) between 3 and 2000) not valid;
exception when others then null; end $$;
do $$ begin
  create unique index reports_open_pair_uniq on public.reports (reporter_id, reported_id)
    where status = 'pending';
exception when others then null; end $$;

-- -------------------------------------------------------------
-- M4: serialize the both-agree success confirmation (no missed 'married').
-- -------------------------------------------------------------
create or replace function public.handle_chat_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.chats; cnt int;
begin
  perform pg_advisory_xact_lock(hashtext(new.chat_id::text));
  select * into s from public.chats where id = new.chat_id;
  if s.id is null then return new; end if;
  if new.status in ('engaged', 'married') then
    select count(distinct user_id) into cnt from public.chat_status
      where chat_id = new.chat_id and status = new.status and user_id in (s.user1_id, s.user2_id);
    if cnt >= 2 then
      update public.chats set confirmed_status = new.status, confirmed_at = now() where id = s.id;
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- M5: rows can't be re-pointed at other sessions/chats/users on update.
-- -------------------------------------------------------------
create or replace function public.pin_session_answer()
returns trigger language plpgsql as $$
begin
  new.session_id := old.session_id;
  new.user_id := old.user_id;
  new.question_index := old.question_index;
  return new;
end $$;
drop trigger if exists trg_pin_session_answer on public.session_answers;
create trigger trg_pin_session_answer before update on public.session_answers
  for each row execute function public.pin_session_answer();

create or replace function public.pin_chat_status()
returns trigger language plpgsql as $$
begin
  new.chat_id := old.chat_id;
  new.user_id := old.user_id;
  return new;
end $$;
drop trigger if exists trg_pin_chat_status on public.chat_status;
create trigger trg_pin_chat_status before update on public.chat_status
  for each row execute function public.pin_chat_status();

notify pgrst, 'reload schema';

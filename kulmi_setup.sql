-- =============================================================
--  KULMI — complete database setup (run this ONE file once)
--  Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--  Safe to re-run.
-- =============================================================

-- =============================================================
--  KULMI — end-to-end migration
--  Run this ONCE in the Supabase SQL editor (Dashboard → SQL).
--  It is idempotent: safe to re-run.
--  Assumes schema.sql (profiles/chats/messages) already applied.
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 1. Extend profiles with the fields the app actually uses
-- -------------------------------------------------------------
alter table public.profiles add column if not exists role                text        not null default 'user';
alter table public.profiles add column if not exists profile_picture_url text;
alter table public.profiles add column if not exists country             text;
alter table public.profiles add column if not exists city                text;
alter table public.profiles add column if not exists occupation          text;
alter table public.profiles add column if not exists education           text;
alter table public.profiles add column if not exists languages           text;
alter table public.profiles add column if not exists marriage_intent     text;
alter table public.profiles add column if not exists timeline            text;
alter table public.profiles add column if not exists relocate            text;
alter table public.profiles add column if not exists children            text;
alter table public.profiles add column if not exists prayer_level        text;
alter table public.profiles add column if not exists islamic_practice    text;
alter table public.profiles add column if not exists faith_statement     text;
alter table public.profiles add column if not exists personality_traits  text[] default '{}';
alter table public.profiles add column if not exists future_goals        text[] default '{}';
alter table public.profiles add column if not exists communication_style text[] default '{}';
alter table public.profiles add column if not exists deal_breakers       text;
alter table public.profiles add column if not exists photo_verified      boolean not null default false;
alter table public.profiles add column if not exists updated_at          timestamptz default now();

-- Require sign-in to read profiles (was: viewable by everyone).
-- Note: RLS is row-level; the client never SELECTs the email column for
-- other users, so emails are not exposed in the discovery/chat UI.
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles are viewable by authenticated users." on public.profiles;
create policy "Profiles are viewable by authenticated users."
  on public.profiles for select to authenticated using (true);

-- (insert / update own-profile policies from schema.sql remain in place)

-- -------------------------------------------------------------
-- 2. Admin helper
-- -------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- -------------------------------------------------------------
-- 3. Invitations (the matching engine)
-- -------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz not null default now(),
  constraint invitations_no_self check (sender_id <> receiver_id),
  unique (sender_id, receiver_id)
);

alter table public.invitations enable row level security;

drop policy if exists "View own invitations" on public.invitations;
create policy "View own invitations" on public.invitations for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id or public.is_admin());

drop policy if exists "Send invitations" on public.invitations;
create policy "Send invitations" on public.invitations for insert to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "Respond to invitations" on public.invitations;
create policy "Respond to invitations" on public.invitations for update to authenticated
  using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

create index if not exists invitations_receiver_idx on public.invitations (receiver_id, status);
create index if not exists invitations_sender_idx   on public.invitations (sender_id, status);

-- -------------------------------------------------------------
-- 4. Auto-create a chat when an invitation is accepted
--    (SECURITY DEFINER so it can insert past chats-RLS safely)
-- -------------------------------------------------------------
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(new.sender_id, new.receiver_id);
  b uuid := greatest(new.sender_id, new.receiver_id);
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    if not exists (
      select 1 from public.chats
      where least(user1_id, user2_id) = a and greatest(user1_id, user2_id) = b
    ) then
      insert into public.chats (user1_id, user2_id) values (new.sender_id, new.receiver_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_invitation_accepted on public.invitations;
create trigger on_invitation_accepted
  after update on public.invitations
  for each row execute function public.handle_invitation_accepted();

-- -------------------------------------------------------------
-- 5. Chats / messages hardening
-- -------------------------------------------------------------
create unique index if not exists chats_unique_pair
  on public.chats (least(user1_id, user2_id), greatest(user1_id, user2_id));
create index if not exists messages_chat_idx on public.messages (chat_id, created_at);

-- Admin read access (dashboard). Regular users keep their own-row policies.
drop policy if exists "Admins view all chats" on public.chats;
create policy "Admins view all chats" on public.chats for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins view all messages" on public.messages;
create policy "Admins view all messages" on public.messages for select to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------
-- 6. Make yourself an admin (edit the email, then run):
--    update public.profiles set role = 'admin'
--    where email = 'you@example.com';
-- =============================================================


-- =============================================================
--  KULMI — compatibility sessions (the guided Q&A that gates a match)
--  Run in the Supabase SQL editor AFTER migration.sql. Idempotent.
--
--  New flow:
--    A invites B  ->  B accepts  ->  a SESSION is created (not a chat)
--    both answer the questions  ->  each makes a PRIVATE yes/no decision
--    both say yes  ->  the chat is created (profiles "unlock")
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tables
-- -------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  user1_id      uuid not null references public.profiles(id) on delete cascade, -- least(uid)
  user2_id      uuid not null references public.profiles(id) on delete cascade, -- greatest(uid)
  status        text not null default 'active' check (status in ('active','completed','ended')),
  created_at    timestamptz not null default now(),
  unique (user1_id, user2_id)
);

create table if not exists public.session_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  question_index int  not null,
  answer         text not null,
  created_at     timestamptz not null default now(),
  unique (session_id, user_id, question_index)
);

create table if not exists public.session_decisions (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  decision   text not null check (decision in ('yes','no')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.sessions          enable row level security;
alter table public.session_answers   enable row level security;
alter table public.session_decisions enable row level security;

-- -------------------------------------------------------------
-- 2. RLS
-- -------------------------------------------------------------
-- Sessions: participants (or admin) can read. Rows are created by a trigger.
drop policy if exists "View own sessions" on public.sessions;
create policy "View own sessions" on public.sessions for select to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id or public.is_admin());

-- Answers: any participant of the session can read all answers in it
-- (the client only reveals the partner's answers once both have finished).
drop policy if exists "View session answers" on public.session_answers;
create policy "View session answers" on public.session_answers for select to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid() or public.is_admin())
  ));

drop policy if exists "Write own answers" on public.session_answers;
create policy "Write own answers" on public.session_answers for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

drop policy if exists "Update own answers" on public.session_answers;
create policy "Update own answers" on public.session_answers for update to authenticated
  using (user_id = auth.uid());

-- Decisions are PRIVATE: you can only read your own (the outcome is applied by a trigger).
drop policy if exists "View own decision" on public.session_decisions;
create policy "View own decision" on public.session_decisions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Write own decision" on public.session_decisions;
create policy "Write own decision" on public.session_decisions for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

create index if not exists session_answers_idx on public.session_answers (session_id, user_id);

-- -------------------------------------------------------------
-- 3. Invitation accepted  ->  create a SESSION (replaces the old
--    "create a chat" behaviour from migration.sql)
-- -------------------------------------------------------------
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(new.sender_id, new.receiver_id);
  b uuid := greatest(new.sender_id, new.receiver_id);
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    if not exists (select 1 from public.sessions where user1_id = a and user2_id = b) then
      insert into public.sessions (invitation_id, user1_id, user2_id) values (new.id, a, b);
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 4. Both decisions = yes  ->  create the chat + complete session
-- -------------------------------------------------------------
create or replace function public.handle_session_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  yes_count int;
begin
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

drop trigger if exists on_session_decision on public.session_decisions;
create trigger on_session_decision
  after insert on public.session_decisions
  for each row execute function public.handle_session_decision();


-- =============================================================
--  KULMI — storage setup for profile photos
--  Run ONCE in the Supabase SQL editor (after migration.sql).
--  Idempotent: safe to re-run.
-- =============================================================

-- Public bucket for avatars (anyone can view; only the owner can write).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Files are stored under  avatars/<user-id>/<filename>
-- so (storage.foldername(name))[1] == the owner's uid.

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- =============================================================
--  KULMI migration v2 — real verification review, wali linkage,
--  user settings, reports, and voice notes.
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 1. New profile columns
-- -------------------------------------------------------------
alter table public.profiles add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified','pending','verified','rejected'));
alter table public.profiles add column if not exists verification_selfie_url text;
alter table public.profiles add column if not exists wali_email        text;
alter table public.profiles add column if not exists show_in_discovery boolean not null default true;
alter table public.profiles add column if not exists push_notifications boolean not null default true;
alter table public.profiles add column if not exists email_summaries    boolean not null default false;
alter table public.profiles add column if not exists read_receipts      boolean not null default true;

-- Bring previously auto-verified rows in line with the new status field.
update public.profiles set verification_status = 'verified'
  where photo_verified = true and verification_status = 'unverified';

-- -------------------------------------------------------------
-- 2. Guard privileged columns (users cannot self-grant role /
--    photo_verified; they may only move their status to 'pending')
-- -------------------------------------------------------------
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select email from public.profiles where id = auth.uid();
$$;

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
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
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Admins may update / delete any profile (for the review queue + moderation).
drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users delete own profile" on public.profiles;
create policy "Users delete own profile" on public.profiles for delete to authenticated
  using (auth.uid() = id or public.is_admin());

-- -------------------------------------------------------------
-- 3. Wali (guardian) read access to their wards' data
--    A "ward" designates their wali by email in Settings.
-- -------------------------------------------------------------
create or replace function public.is_ward(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target
      and p.wali_email is not null
      and lower(p.wali_email) = lower(public.my_email())
  );
$$;

drop policy if exists "Wali views ward chats" on public.chats;
create policy "Wali views ward chats" on public.chats for select to authenticated
  using (public.is_ward(user1_id) or public.is_ward(user2_id));

drop policy if exists "Wali views ward messages" on public.messages;
create policy "Wali views ward messages" on public.messages for select to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id and (public.is_ward(c.user1_id) or public.is_ward(c.user2_id))
  ));

drop policy if exists "Wali views ward sessions" on public.sessions;
create policy "Wali views ward sessions" on public.sessions for select to authenticated
  using (public.is_ward(user1_id) or public.is_ward(user2_id));

-- -------------------------------------------------------------
-- 4. Reports (moderation)
-- -------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  status      text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;

drop policy if exists "Create reports" on public.reports;
create policy "Create reports" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "View reports" on public.reports;
create policy "View reports" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports" on public.reports for update to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------
-- 5. Voice notes
-- -------------------------------------------------------------
alter table public.messages add column if not exists type text not null default 'text'
  check (type in ('text','audio'));

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Media publicly readable" on storage.objects;
create policy "Media publicly readable" on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "Users upload own media" on storage.objects;
create policy "Users upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own media" on storage.objects;
create policy "Users delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);


-- =============================================================
--  KULMI migration v3 — profile privacy hardening + extra
--  onboarding fields. Run in the Supabase SQL editor AFTER the
--  earlier migrations. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Extra profile fields collected at onboarding
-- -------------------------------------------------------------
alter table public.profiles add column if not exists marital_status text;
alter table public.profiles add column if not exists height         text;
alter table public.profiles add column if not exists heritage       text; -- e.g. Somali region / background
alter table public.profiles add column if not exists has_children   text;

-- -------------------------------------------------------------
-- 2. Lock the base table: a user may read only their OWN full row.
--    (Admins and a member's Wali can also read — see helpers.)
--    This stops any signed-in user from reading everyone's email,
--    private deal-breakers, wali email, verification selfies, etc.
-- -------------------------------------------------------------
drop policy if exists "Profiles are viewable by authenticated users." on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles readable by owner, admin, wali" on public.profiles;
create policy "Profiles readable by owner, admin, wali"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_admin() or public.is_ward(id));

-- -------------------------------------------------------------
-- 3. Safe public view for discovery / chat partners / names.
--    Exposes ONLY non-sensitive columns; runs with definer rights
--    so it can read across users while the base table stays locked.
-- -------------------------------------------------------------
drop view if exists public.public_profiles;
create view public.public_profiles as
  select
    id, first_name, age, gender, location, bio, role, profile_picture_url,
    country, city, occupation, education, languages, marital_status, height, heritage,
    marriage_intent, timeline, relocate, children, has_children,
    prayer_level, islamic_practice, faith_statement,
    personality_traits, future_goals, communication_style,
    photo_verified, verification_status, show_in_discovery
  from public.profiles;

alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to authenticated;

-- Tell PostgREST to refresh its schema cache immediately so the API sees the
-- new view without waiting (fixes "Could not find the table public_profiles").
notify pgrst, 'reload schema';


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


-- =============================================================
--  KULMI migration v5 — photo gallery with gated reveal
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--
--  Everyone sees ONLY a member's main photo (profile_picture_url) in Discover.
--  The extra photos (gallery) are revealed ONLY to a matched partner (someone
--  who shares a chat with them) — the app's differentiator.
-- =============================================================

alter table public.profiles add column if not exists gallery text[] default '{}';

-- Returns a member's extra photos ONLY if the caller is matched with them
-- (i.e. they share a chat). Otherwise returns an empty array.
create or replace function public.get_gallery(target uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(p.gallery, '{}')
  from public.profiles p
  where p.id = target
    and exists (
      select 1 from public.chats c
      where (c.user1_id = auth.uid() and c.user2_id = target)
         or (c.user2_id = auth.uid() and c.user1_id = target)
    );
$$;
grant execute on function public.get_gallery(uuid) to authenticated;

-- NOTE: `gallery` is deliberately NOT added to the public_profiles view, so it
-- can never leak in discovery — extra photos are reachable only via get_gallery.

notify pgrst, 'reload schema';



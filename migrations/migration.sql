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

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

do $$ begin
  insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
exception when others then null; end $$;

drop policy if exists "Media publicly readable" on storage.objects;
create policy "Media publicly readable" on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "Users upload own media" on storage.objects;
create policy "Users upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own media" on storage.objects;
create policy "Users delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

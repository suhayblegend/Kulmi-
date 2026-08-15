-- =============================================================
--  KULMI migration v27 — Kulmi+ membership. Idempotent.
--  plan/premium_until/founding + profile views + priority verify.
-- =============================================================

alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists premium_until timestamptz;
alter table public.profiles add column if not exists founding_member boolean not null default false;
alter table public.profiles add column if not exists stripe_customer_id text;

-- Premium = active subscription OR a still-running gifted period.
create or replace function public.is_premium(target uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select plan = 'premium' or (premium_until is not null and premium_until > now())
    from public.profiles where id = target
  ), false);
$$;
grant execute on function public.is_premium(uuid) to authenticated;

-- Founding offer: anyone who signs up before 1 Sept 2026 gets Kulmi+ free
-- until 30 Sept 2026.
create or replace function public.grant_founding_offer()
returns trigger language plpgsql as $$
begin
  if now() < '2026-09-01T00:00:00Z' then
    new.founding_member := true;
    new.premium_until := '2026-09-30T23:59:59Z';
  end if;
  return new;
end $$;
drop trigger if exists trg_founding_offer on public.profiles;
create trigger trg_founding_offer before insert on public.profiles
  for each row execute function public.grant_founding_offer();

-- Members must not be able to self-grant premium: pin billing columns.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' then
    new.email := old.email;
    new.role := coalesce(old.role, 'user');
    new.photo_verified := coalesce(old.photo_verified, false);
    new.wali_confirmed := coalesce(old.wali_confirmed, false);
    new.plan := coalesce(old.plan, 'free');
    new.premium_until := old.premium_until;
    new.founding_member := coalesce(old.founding_member, false);
    new.stripe_customer_id := old.stripe_customer_id;
    if new.profile_picture_url is not distinct from old.profile_picture_url then
      new.photo_hash := old.photo_hash;
    end if;
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      new.verification_status := old.verification_status;
    end if;
  else
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    new.role := 'user';
    new.photo_verified := false;
    new.wali_confirmed := false;
    new.plan := 'free';
    new.stripe_customer_id := null;
    -- founding trigger (runs after this, alphabetically) may set premium_until
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;
  return new;
end $$;

-- Who viewed you (premium feature). One row per pair, newest view wins.
create table if not exists public.profile_views (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id)
);
alter table public.profile_views enable row level security;

drop policy if exists "Record own views" on public.profile_views;
create policy "Record own views" on public.profile_views
  for insert to authenticated with check (viewer_id = auth.uid() and viewer_id <> viewed_id);
drop policy if exists "Refresh own views" on public.profile_views;
create policy "Refresh own views" on public.profile_views
  for update to authenticated using (viewer_id = auth.uid());

-- Premium members see who viewed THEM (safe columns via definer fn).
create or replace function public.get_my_viewers()
returns table (id uuid, first_name text, age int, city text, country text,
               profile_picture_url text, verification_status text, viewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.age, p.city, p.country,
         p.profile_picture_url, p.verification_status, v.viewed_at
  from public.profile_views v
  join public.profiles p on p.id = v.viewer_id
  where v.viewed_id = auth.uid()
    and public.is_premium(auth.uid())
    and p.verification_status = 'verified'
  order by v.viewed_at desc
  limit 50;
$$;
grant execute on function public.get_my_viewers() to authenticated;

notify pgrst, 'reload schema';

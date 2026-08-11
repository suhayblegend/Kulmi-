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

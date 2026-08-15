-- =============================================================
--  KULMI — rebuild the public_profiles view (fixes "column
--  public_profiles.<x> does not exist" errors after an update).
--  Self-contained: ensures every column exists, then recreates the view.
--  Run in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1. Ensure every column the view reads exists (no-ops if already there)
alter table public.profiles add column if not exists role                text not null default 'user';
alter table public.profiles add column if not exists profile_picture_url text;
alter table public.profiles add column if not exists country             text;
alter table public.profiles add column if not exists city                text;
alter table public.profiles add column if not exists occupation          text;
alter table public.profiles add column if not exists education           text;
alter table public.profiles add column if not exists languages           text;
alter table public.profiles add column if not exists marital_status      text;
alter table public.profiles add column if not exists height              text;
alter table public.profiles add column if not exists heritage            text;
alter table public.profiles add column if not exists marriage_intent     text;
alter table public.profiles add column if not exists timeline            text;
alter table public.profiles add column if not exists relocate            text;
alter table public.profiles add column if not exists children            text;
alter table public.profiles add column if not exists has_children        text;
alter table public.profiles add column if not exists prayer_level        text;
alter table public.profiles add column if not exists islamic_practice    text;
alter table public.profiles add column if not exists faith_statement     text;
alter table public.profiles add column if not exists personality_traits  text[] default '{}';
alter table public.profiles add column if not exists future_goals        text[] default '{}';
alter table public.profiles add column if not exists communication_style text[] default '{}';
alter table public.profiles add column if not exists photo_verified      boolean not null default false;
alter table public.profiles add column if not exists verification_status text not null default 'unverified';
alter table public.profiles add column if not exists show_in_discovery   boolean not null default true;
alter table public.profiles add column if not exists gallery             text[] default '{}';
alter table public.profiles add column if not exists intro_audio_url     text;
alter table public.profiles add column if not exists intro_public        boolean not null default false;
alter table public.profiles add column if not exists last_name           text;

-- 2. Rebuild the safe public view (safe columns + the public voice intro)
drop view if exists public.public_profiles;
create view public.public_profiles as
  select
    id, first_name, age, gender, location, bio, role, profile_picture_url,
    country, city, occupation, education, languages, marital_status, height, heritage,
    marriage_intent, timeline, relocate, children, has_children,
    prayer_level, islamic_practice, faith_statement,
    personality_traits, future_goals, communication_style,
    photo_verified, verification_status, show_in_discovery,
    case when intro_public then intro_audio_url else null end as intro_audio_url
  from public.profiles;

alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to authenticated;

-- 3. Refresh the API cache
notify pgrst, 'reload schema';

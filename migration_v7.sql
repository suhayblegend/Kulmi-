-- =============================================================
--  KULMI migration v7 — voice intro (replaces video)
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--
--  A member can record a short voice intro and choose who hears it:
--   • intro_public = true  → played to everyone in Discover
--   • intro_public = false → played only to a match (shared chat)
-- =============================================================

alter table public.profiles add column if not exists intro_audio_url text;
alter table public.profiles add column if not exists intro_public    boolean not null default false;

-- Rebuild the public view: expose the intro in Discover ONLY if it's public.
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

-- A match always hears the intro (even a private one).
create or replace function public.get_intro(target uuid)
returns text language sql stable security definer set search_path = public as $$
  select p.intro_audio_url
  from public.profiles p
  where p.id = target
    and exists (
      select 1 from public.chats c
      where (c.user1_id = auth.uid() and c.user2_id = target)
         or (c.user2_id = auth.uid() and c.user1_id = target)
    );
$$;
grant execute on function public.get_intro(uuid) to authenticated;

notify pgrst, 'reload schema';

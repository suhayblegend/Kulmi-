-- =============================================================
--  KULMI migration v20 — lifestyle & values fields. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists smoking text;
alter table public.profiles add column if not exists khat text;
alter table public.profiles add column if not exists religious_dress text; -- hijab (sisters) / beard (brothers)
alter table public.profiles add column if not exists open_to_polygyny text;

-- Rebuild the public view to expose the new lifestyle fields to other members.
drop view if exists public.public_profiles cascade; -- cascade: get_my_wards() depends on the view and is recreated below/later
create view public.public_profiles as
  select
    id, first_name, age, gender, location, bio, role, profile_picture_url,
    country, city, occupation, education, languages, marital_status, height, heritage,
    marriage_intent, timeline, relocate, children, has_children,
    prayer_level, islamic_practice, faith_statement,
    religious_dress, smoking, khat, open_to_polygyny,
    personality_traits, future_goals, communication_style,
    photo_verified, verification_status, show_in_discovery,
    case when intro_public then intro_audio_url else null end as intro_audio_url
  from public.profiles;
alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to authenticated;

notify pgrst, 'reload schema';

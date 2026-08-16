-- =============================================================
--  KULMI migration v34 — optional qabiil (clan/lineage) field.
--  Optional; members choose whether to share it. Idempotent.
-- =============================================================

alter table public.profiles add column if not exists qabiil text;

-- Expose it on the safe public data (like heritage) so matches can see it.
drop view if exists public.public_profiles cascade;  -- get_my_wards depends on it; recreated below
create view public.public_profiles as
  select
    id, first_name, age, gender, location, bio, role, profile_picture_url,
    country, city, occupation, education, languages, marital_status, height, heritage, qabiil,
    marriage_intent, timeline, relocate, children, has_children,
    prayer_level, islamic_practice, faith_statement,
    religious_dress, smoking, khat, open_to_polygyny,
    personality_traits, future_goals, communication_style,
    photo_verified, verification_status, show_in_discovery,
    case when intro_public then intro_audio_url else null end as intro_audio_url,
    (plan = 'premium' or (premium_until is not null and premium_until > now())) as is_premium
  from public.profiles
  where coalesce(show_in_discovery, true) = true and verification_status = 'verified';
alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to authenticated;

create or replace function public.get_my_wards()
returns setof public.public_profiles
language sql stable security definer set search_path = public as $$
  select
    p.id, p.first_name, p.age, p.gender, p.location, p.bio, p.role,
    p.profile_picture_url, p.country, p.city, p.occupation, p.education,
    p.languages, p.marital_status, p.height, p.heritage, p.qabiil,
    p.marriage_intent, p.timeline, p.relocate, p.children, p.has_children,
    p.prayer_level, p.islamic_practice, p.faith_statement,
    p.religious_dress, p.smoking, p.khat, p.open_to_polygyny,
    p.personality_traits, p.future_goals, p.communication_style,
    p.photo_verified, p.verification_status, p.show_in_discovery,
    case when p.intro_public then p.intro_audio_url else null end,
    (p.plan = 'premium' or (p.premium_until is not null and p.premium_until > now()))
  from public.profiles p
  where p.wali_email is not null
    and p.wali_confirmed = true
    and lower(p.wali_email) = lower(public.my_email());
$$;
grant execute on function public.get_my_wards() to authenticated;

drop function if exists public.get_profile_cards(uuid[]);
create or replace function public.get_profile_cards(ids uuid[])
returns table (
  id uuid, first_name text, age int, gender text, location text, bio text, role text,
  profile_picture_url text, country text, city text, occupation text, education text,
  languages text, marital_status text, height text, heritage text, qabiil text,
  marriage_intent text, timeline text, relocate text, children text, has_children text,
  prayer_level text, islamic_practice text, faith_statement text,
  religious_dress text, smoking text, khat text, open_to_polygyny text,
  personality_traits text[], future_goals text[], communication_style text[],
  photo_verified boolean, verification_status text, show_in_discovery boolean,
  intro_audio_url text, is_premium boolean
) language sql stable security definer set search_path = public as $$
  select
    p.id, p.first_name, p.age, p.gender, p.location, p.bio, p.role,
    p.profile_picture_url, p.country, p.city, p.occupation, p.education,
    p.languages, p.marital_status, p.height, p.heritage, p.qabiil,
    p.marriage_intent, p.timeline, p.relocate, p.children, p.has_children,
    p.prayer_level, p.islamic_practice, p.faith_statement,
    p.religious_dress, p.smoking, p.khat, p.open_to_polygyny,
    p.personality_traits, p.future_goals, p.communication_style,
    p.photo_verified, p.verification_status, p.show_in_discovery,
    case when p.intro_public then p.intro_audio_url else null end,
    (p.plan = 'premium' or (p.premium_until is not null and p.premium_until > now()))
  from public.profiles p
  where p.id = any(ids)
    and (
      public.is_admin()
      or exists (select 1 from public.chats c
        where (c.user1_id = auth.uid() and c.user2_id = p.id) or (c.user2_id = auth.uid() and c.user1_id = p.id))
      or exists (select 1 from public.sessions s
        where (s.user1_id = auth.uid() and s.user2_id = p.id) or (s.user2_id = auth.uid() and s.user1_id = p.id))
      or exists (select 1 from public.invitations i
        where (i.sender_id = auth.uid() and i.receiver_id = p.id) or (i.receiver_id = auth.uid() and i.sender_id = p.id))
    );
$$;
grant execute on function public.get_profile_cards(uuid[]) to authenticated;

notify pgrst, 'reload schema';

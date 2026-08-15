-- =============================================================
--  KULMI migration v24 — wali email verification. Idempotent.
--  A wali only gains access AFTER confirming via the emailed link.
-- =============================================================

alter table public.profiles add column if not exists wali_confirmed boolean default false;

-- Changing the wali email always resets confirmation.
create or replace function public.reset_wali_confirmation()
returns trigger language plpgsql as $$
begin
  if new.wali_email is distinct from old.wali_email then
    new.wali_confirmed := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_reset_wali_confirm on public.profiles;
create trigger trg_reset_wali_confirm before update on public.profiles
  for each row execute function public.reset_wali_confirmation();

-- Wali access now requires confirmation.
create or replace function public.is_ward(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target
      and p.wali_email is not null
      and p.wali_confirmed = true
      and lower(p.wali_email) = lower(public.my_email())
  );
$$;

create or replace function public.get_my_wards()
returns setof public.public_profiles
language sql stable security definer set search_path = public as $$
  select
    p.id, p.first_name, p.age, p.gender, p.location, p.bio, p.role,
    p.profile_picture_url, p.country, p.city, p.occupation, p.education,
    p.languages, p.marital_status, p.height, p.heritage,
    p.marriage_intent, p.timeline, p.relocate, p.children, p.has_children,
    p.prayer_level, p.islamic_practice, p.faith_statement,
    p.religious_dress, p.smoking, p.khat, p.open_to_polygyny,
    p.personality_traits, p.future_goals, p.communication_style,
    p.photo_verified, p.verification_status, p.show_in_discovery,
    case when p.intro_public then p.intro_audio_url else null end
  from public.profiles p
  where p.wali_email is not null
    and p.wali_confirmed = true
    and lower(p.wali_email) = lower(public.my_email());
$$;
grant execute on function public.get_my_wards() to authenticated;

notify pgrst, 'reload schema';

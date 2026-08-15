-- =============================================================
--  KULMI migration v22 — close the remaining audit risks. Idempotent.
--  R1 profile enumeration · R2 rate limits · R3 accept race ·
--  R4 legacy public intros.
-- =============================================================

-- -------------------------------------------------------------
-- R1a: the public view now only exposes members who are verified AND visible
-- in discovery — no more enumerating hidden/suspended users via the API.
-- -------------------------------------------------------------
-- Safety net: make sure every column the view references actually exists on
-- profiles, even if an earlier migration was skipped. Prevents both the view
-- creation and the discovery page from failing on a missing column.
alter table public.profiles add column if not exists religious_dress text;
alter table public.profiles add column if not exists smoking text;
alter table public.profiles add column if not exists khat text;
alter table public.profiles add column if not exists open_to_polygyny text;
alter table public.profiles add column if not exists intro_public boolean default false;
alter table public.profiles add column if not exists intro_audio_url text;
alter table public.profiles add column if not exists show_in_discovery boolean default true;
alter table public.profiles add column if not exists personality_traits text[];
alter table public.profiles add column if not exists future_goals text[];
alter table public.profiles add column if not exists communication_style text[];

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
  from public.profiles
  where coalesce(show_in_discovery, true) = true and verification_status = 'verified';
alter view public.public_profiles set (security_invoker = off);
grant select on public.public_profiles to authenticated;

-- -------------------------------------------------------------
-- R1b: people you already have a relationship with (invitation, session, or
-- chat — either direction) stay readable even if they later hide from
-- discovery, via this definer function. Admins can read any.
-- -------------------------------------------------------------
create or replace function public.get_profile_cards(ids uuid[])
returns table (
  id uuid, first_name text, age int, gender text, location text, bio text, role text,
  profile_picture_url text, country text, city text, occupation text, education text,
  languages text, marital_status text, height text, heritage text,
  marriage_intent text, timeline text, relocate text, children text, has_children text,
  prayer_level text, islamic_practice text, faith_statement text,
  religious_dress text, smoking text, khat text, open_to_polygyny text,
  personality_traits text[], future_goals text[], communication_style text[],
  photo_verified boolean, verification_status text, show_in_discovery boolean,
  intro_audio_url text
) language sql stable security definer set search_path = public as $$
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

-- -------------------------------------------------------------
-- R2: rate limits on the open write surfaces (spam protection).
-- -------------------------------------------------------------
create or replace function public.throttle_contact_messages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many messages right now — please try again later.';
  end if;
  if new.email is not null and (select count(*) from public.contact_messages
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have already sent several messages — we will reply soon, insha''Allah.';
  end if;
  return new;
end $$;
drop trigger if exists trg_throttle_contact on public.contact_messages;
create trigger trg_throttle_contact before insert on public.contact_messages
  for each row execute function public.throttle_contact_messages();

create or replace function public.throttle_account_deletions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.account_deletions where created_at > now() - interval '1 hour') >= 20 then
    return null; -- silently drop feedback spam; never blocks the actual deletion
  end if;
  return new;
end $$;
drop trigger if exists trg_throttle_deletions on public.account_deletions;
create trigger trg_throttle_deletions before insert on public.account_deletions
  for each row execute function public.throttle_account_deletions();

-- -------------------------------------------------------------
-- R3: simultaneous mutual accepts (A→B and B→A) can no longer surface a
-- duplicate-key error — serialized + conflict-safe.
-- -------------------------------------------------------------
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(new.sender_id, new.receiver_id);
  b uuid := greatest(new.sender_id, new.receiver_id);
  qs text[];
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    perform pg_advisory_xact_lock(hashtext(a::text || b::text));
    if not exists (select 1 from public.sessions where user1_id = a and user2_id = b) then
      select compat_questions into qs from public.profiles where id = new.sender_id;
      insert into public.sessions (invitation_id, user1_id, user2_id, questions)
      values (new.id, a, b, qs)
      on conflict (user1_id, user2_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- R4: legacy voice intros lived in the PUBLIC media bucket. Kill public access
-- and clear the stale references (members simply re-record — new intros are
-- private). The media bucket is no longer used for anything new.
-- -------------------------------------------------------------
drop policy if exists "Media publicly readable" on storage.objects;
update public.profiles set intro_audio_url = null where intro_audio_url like '%/media/%';

-- -------------------------------------------------------------
-- Recreate get_my_wards(): it depends on the public_profiles view type, so the
-- cascade drops above removed it — rebuild it against the final view.
-- -------------------------------------------------------------
-- Reads the BASE table (same safe columns as the view) so a wali still sees
-- their ward while the ward is unverified or hidden from discovery.
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
    and lower(p.wali_email) = lower(public.my_email());
$$;
grant execute on function public.get_my_wards() to authenticated;

notify pgrst, 'reload schema';

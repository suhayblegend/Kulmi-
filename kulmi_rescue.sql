-- =============================================================
--  KULMI RESCUE v3 — migrations v9 through v23, in order.
--  Idempotent, safe to re-run. Paste ALL, click in editor
--  (nothing highlighted), then Run.
-- =============================================================

-- >>> migration_v9.sql
-- =============================================================
--  KULMI migration v9 — auto-detected location coordinates
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--  Coordinates are PRIVATE (not in the public view) — only city/country show.
-- =============================================================

alter table public.profiles add column if not exists latitude  double precision;
alter table public.profiles add column if not exists longitude double precision;

notify pgrst, 'reload schema';


-- >>> migration_v10.sql
-- =============================================================
--  KULMI migration v10 — audit fixes (delete cascade, enforce
--  verification server-side, 18+). Run AFTER earlier migrations. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- C1: account deletion was blocked by RESTRICT foreign keys on chats/messages.
--     Cascade so deleting a profile removes their chats + messages.
-- -------------------------------------------------------------
alter table public.chats drop constraint if exists chats_user1_id_fkey;
alter table public.chats add  constraint chats_user1_id_fkey foreign key (user1_id) references public.profiles(id) on delete cascade;
alter table public.chats drop constraint if exists chats_user2_id_fkey;
alter table public.chats add  constraint chats_user2_id_fkey foreign key (user2_id) references public.profiles(id) on delete cascade;
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add  constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete cascade;
alter table public.messages drop constraint if exists messages_chat_id_fkey;
alter table public.messages add  constraint messages_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade;

-- -------------------------------------------------------------
-- C3: enforce identity verification in the DATABASE, not just the UI.
--     Unverified members can no longer send invitations or take part in a
--     session via direct API calls. (Admins exempt.)
-- -------------------------------------------------------------
create or replace function public.is_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select verification_status = 'verified' from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "Send invitations" on public.invitations;
create policy "Send invitations" on public.invitations for insert to authenticated
  with check (auth.uid() = sender_id and (public.is_verified() or public.is_admin()));

drop policy if exists "Write own answers" on public.session_answers;
create policy "Write own answers" on public.session_answers for insert to authenticated
  with check (user_id = auth.uid() and (public.is_verified() or public.is_admin()) and exists (
    select 1 from public.sessions s where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

drop policy if exists "Write own decision" on public.session_decisions;
create policy "Write own decision" on public.session_decisions for insert to authenticated
  with check (user_id = auth.uid() and (public.is_verified() or public.is_admin()) and exists (
    select 1 from public.sessions s where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

-- -------------------------------------------------------------
-- H5: 18+ only (child-safety). Enforced for new/updated rows.
-- -------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_age_18plus;
alter table public.profiles add constraint profiles_age_18plus check (age is null or age >= 18) not valid;

notify pgrst, 'reload schema';


-- >>> migration_v11.sql
-- =============================================================
--  KULMI migration v11 — "Stop contact" (dignified alternative to
--  dating-app "block") + tighter invitation transitions. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- H4: let a member quietly prevent further contact from someone.
--     Framed in the app as "End & stop contact", not "block".
-- -------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

drop policy if exists "Manage own blocks" on public.blocks;
create policy "Manage own blocks" on public.blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

-- Admins can see blocks (for safety review).
drop policy if exists "Admins view blocks" on public.blocks;
create policy "Admins view blocks" on public.blocks for select to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------
-- No invitations may cross a "stop contact" in EITHER direction,
-- and the sender must be verified (carried over from v10).
-- -------------------------------------------------------------
drop policy if exists "Send invitations" on public.invitations;
create policy "Send invitations" on public.invitations for insert to authenticated
  with check (
    auth.uid() = sender_id
    and (public.is_verified() or public.is_admin())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = receiver_id and b.blocked_id = sender_id)
         or (b.blocker_id = sender_id and b.blocked_id = receiver_id)
    )
  );

-- -------------------------------------------------------------
-- L5: a receiver may only accept/decline a still-PENDING invite
--     (no re-opening an accepted/declined one).
-- -------------------------------------------------------------
drop policy if exists "Respond to invitations" on public.invitations;
create policy "Respond to invitations" on public.invitations for update to authenticated
  using (auth.uid() = receiver_id and status = 'pending')
  with check (auth.uid() = receiver_id and status in ('accepted', 'declined'));

notify pgrst, 'reload schema';


-- >>> migration_v12.sql
-- =============================================================
--  KULMI migration v12 — PRIVATE media bucket + notifications
--  Run in the Supabase SQL editor. Idempotent.
--
--  C2: verification selfies, gallery photos, and chat voice notes move to a
--      PRIVATE bucket ("secure"). They are no longer fetchable by URL — the app
--      reads them with short-lived signed URLs, gated by these storage policies.
--      Paths are  secure/<uid>/<category>/<file>  where category ∈ selfie|gallery|voice.
--        - selfie  : only the owner + admins (verification review)
--        - gallery : the owner, admins, and anyone who shares a chat (a match)
--        - voice   : same as gallery (private conversation audio)
--      Main profile photos stay in the public "avatars" bucket by design.
-- =============================================================

do $$ begin
  insert into storage.buckets (id, name, public) values ('secure', 'secure', false) on conflict (id) do update set public = false;
exception when others then null; end $$;

-- owner of an object = first path segment
--   (storage.foldername(name))[1]  -> uid
--   (storage.foldername(name))[2]  -> category (selfie | gallery | voice)

drop policy if exists "Secure upload own" on storage.objects;
create policy "Secure upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'secure' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Secure update own" on storage.objects;
create policy "Secure update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'secure' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Secure delete own" on storage.objects;
create policy "Secure delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'secure' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Secure read gated" on storage.objects;
create policy "Secure read gated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'secure' and (
      (storage.foldername(name))[1] = auth.uid()::text          -- your own files
      or public.is_admin()                                      -- admins (selfie review)
      or (
        (storage.foldername(name))[2] in ('gallery', 'voice')   -- match-only media
        and exists (
          select 1 from public.chats c
          where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
             or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid)
        )
      )
    )
  );

-- -------------------------------------------------------------
-- H2: in-app notifications. A row is inserted for the recipient on a new
--     invitation, a new match (chat), and a new message. The bell in the header
--     reads + subscribes to these in realtime.
-- -------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,                       -- 'invitation' | 'match' | 'message'
  body text not null,
  link text,                                -- app path to open (e.g. /chats)
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Update own notifications" on public.notifications;
create policy "Update own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notifications are created by SECURITY DEFINER triggers (below), never by clients.
revoke insert on public.notifications from authenticated;

-- helper: display name (first name) for a user
create or replace function public.notif_name(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(first_name, ''), 'Someone') from public.profiles where id = uid;
$$;

-- new invitation -> notify the receiver
create or replace function public.on_invitation_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, body, link)
  values (new.receiver_id, 'invitation',
          public.notif_name(new.sender_id) || ' sent you an introduction request.', '/discover');
  return new;
end $$;
drop trigger if exists trg_invitation_notify on public.invitations;
create trigger trg_invitation_notify after insert on public.invitations
  for each row execute function public.on_invitation_notify();

-- new chat (mutual match) -> notify both people
create or replace function public.on_chat_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, body, link)
  values (new.user1_id, 'match', 'You have a new match with ' || public.notif_name(new.user2_id) || '! Say salaam.', '/chats'),
         (new.user2_id, 'match', 'You have a new match with ' || public.notif_name(new.user1_id) || '! Say salaam.', '/chats');
  return new;
end $$;
drop trigger if exists trg_chat_notify on public.chats;
create trigger trg_chat_notify after insert on public.chats
  for each row execute function public.on_chat_notify();

-- new message -> notify the OTHER participant
create or replace function public.on_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid;
begin
  select case when c.user1_id = new.sender_id then c.user2_id else c.user1_id end
    into recipient from public.chats c where c.id = new.chat_id;
  if recipient is not null then
    insert into public.notifications (user_id, type, body, link)
    values (recipient, 'message', public.notif_name(new.sender_id) || ' sent you a message.', '/chats');
  end if;
  return new;
end $$;
drop trigger if exists trg_message_notify on public.messages;
create trigger trg_message_notify after insert on public.messages
  for each row execute function public.on_message_notify();

-- Enable realtime for the notification bell (idempotent — ignore if already added).
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';


-- >>> migration_v13.sql
-- =============================================================
--  KULMI migration v13 — make "stop contact" airtight. Idempotent.
--  Fixes two gaps: (1) a stopped person could still message the old chat;
--  (2) people who stopped contact with ME still showed in my Discover, and
--  their messages still pinged my bell on a hidden chat.
-- =============================================================

-- (1) A message may only be inserted by a chat participant AND only when there
--     is no "stop contact" between the two people (either direction). This kills
--     the conversation for a blocked pair. Also pins sender_id to the caller.
drop policy if exists "Users can insert messages in their chats." on public.messages;
create policy "Users can insert messages in their chats." on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chats c
    where c.id = messages.chat_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = c.user1_id and b.blocked_id = c.user2_id)
           or (b.blocker_id = c.user2_id and b.blocked_id = c.user1_id)
      )
  )
);

-- (2a) Return everyone I've stopped contact with OR who has stopped contact with
--      me, as a bare id list (does not reveal direction) — used to hide them from
--      Discover in both directions. SECURITY DEFINER so the "they blocked me"
--      rows (which my own RLS can't see) are included.
create or replace function public.blocked_user_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;
grant execute on function public.blocked_user_ids() to authenticated;

-- (2b) Don't raise a message notification when the sender and recipient have
--      stopped contact, or when the recipient has already ended that chat.
create or replace function public.on_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid;
begin
  select case when c.user1_id = new.sender_id then c.user2_id else c.user1_id end
    into recipient from public.chats c where c.id = new.chat_id;
  if recipient is null then return new; end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = recipient and b.blocked_id = new.sender_id)
       or (b.blocker_id = new.sender_id and b.blocked_id = recipient)
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.chat_status cs
    where cs.chat_id = new.chat_id and cs.user_id = recipient and cs.status = 'ended'
  ) then
    return new;
  end if;

  insert into public.notifications (user_id, type, body, link)
  values (recipient, 'message', public.notif_name(new.sender_id) || ' sent you a message.', '/chats');
  return new;
end $$;

notify pgrst, 'reload schema';


-- >>> migration_v14.sql
-- =============================================================
--  KULMI migration v14 — customisable compatibility questions +
--  voice answers. Idempotent.
-- =============================================================

-- Per-user preferred/ordered question set (null = use the app defaults).
alter table public.profiles add column if not exists compat_questions text[];

-- Snapshot of the exact questions a given session uses (null = defaults).
alter table public.sessions add column if not exists questions text[];

-- Optional voice answer (private "secure" bucket path). Text answer may be
-- blank when a voice answer is given, so relax the NOT NULL.
alter table public.session_answers add column if not exists answer_audio text;
alter table public.session_answers alter column answer drop not null;

-- When an invitation is accepted, snapshot the INVITER's preferred questions
-- onto the new session so both people answer the same list.
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(new.sender_id, new.receiver_id);
  b uuid := greatest(new.sender_id, new.receiver_id);
  qs text[];
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    if not exists (select 1 from public.sessions where user1_id = a and user2_id = b) then
      select compat_questions into qs from public.profiles where id = new.sender_id;
      insert into public.sessions (invitation_id, user1_id, user2_id, questions)
      values (new.id, a, b, qs);
    end if;
  end if;
  return new;
end;
$$;

-- Allow session partners to read each other's VOICE ANSWER audio (category
-- 'answer'), in addition to the earlier gallery/voice (chat) + selfie (admin) rules.
drop policy if exists "Secure read gated" on storage.objects;
create policy "Secure read gated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'secure' and (
      (storage.foldername(name))[1] = auth.uid()::text          -- your own files
      or public.is_admin()                                      -- admins (selfie review)
      or (
        (storage.foldername(name))[2] in ('gallery', 'voice')   -- match-only media
        and exists (
          select 1 from public.chats c
          where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
             or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid)
        )
      )
      or (
        (storage.foldername(name))[2] = 'answer'                -- compatibility voice answers
        and exists (
          select 1 from public.sessions s
          where (s.user1_id = auth.uid() and s.user2_id = ((storage.foldername(name))[1])::uuid)
             or (s.user2_id = auth.uid() and s.user1_id = ((storage.foldername(name))[1])::uuid)
        )
      )
    )
  );

notify pgrst, 'reload schema';


-- >>> migration_v15.sql
-- =============================================================
--  KULMI migration v15 — wali login fix + contact messages. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Wali fix: a guardian may not have a member profile row, so resolve their
-- email from the JWT as a fallback. This makes get_my_wards()/is_ward() work
-- for a wali who only has an auth account.
-- -------------------------------------------------------------
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select email from public.profiles where id = auth.uid()),
    auth.jwt() ->> 'email'
  );
$$;

-- -------------------------------------------------------------
-- Contact form: anyone (even logged-out) can send a message; only admins read.
-- -------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can send a contact message" on public.contact_messages;
create policy "Anyone can send a contact message" on public.contact_messages
  for insert to anon, authenticated with check (char_length(message) between 1 and 5000);

drop policy if exists "Admins read contact messages" on public.contact_messages;
create policy "Admins read contact messages" on public.contact_messages
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins update contact messages" on public.contact_messages;
create policy "Admins update contact messages" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists contact_messages_idx on public.contact_messages (handled, created_at desc);

notify pgrst, 'reload schema';


-- >>> migration_v16.sql
-- =============================================================
--  KULMI migration v16 — email unsubscribe. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists email_unsubscribed boolean not null default false;

notify pgrst, 'reload schema';


-- >>> migration_v17.sql
-- =============================================================
--  KULMI migration v17 — block duplicate / reused profile photos.
--  Each real person's main photo is unique across the platform, so a
--  stolen/stock/celebrity image can't be used on more than one account.
--  Idempotent.
-- =============================================================
alter table public.profiles add column if not exists photo_hash text;

-- Pre-existing duplicates (e.g. test accounts that reused one photo) would
-- block the unique index — keep the hash on the OLDEST account per photo and
-- clear it on the rest, so the index always builds.
update public.profiles p
set photo_hash = null
where photo_hash is not null
  and exists (
    select 1 from public.profiles q
    where q.photo_hash = p.photo_hash
      and q.id <> p.id
      and (q.created_at < p.created_at or (q.created_at = p.created_at and q.id < p.id))
  );

-- Two different accounts can't share the same main photo. (A user re-saving
-- their own same photo keeps their own row's value — no conflict.)
create unique index if not exists profiles_photo_hash_uniq
  on public.profiles (photo_hash) where photo_hash is not null;

notify pgrst, 'reload schema';


-- >>> migration_v18.sql
-- =============================================================
--  KULMI migration v18 — verification rejection reason. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists verification_note text;

notify pgrst, 'reload schema';


-- >>> migration_v19.sql
-- =============================================================
--  KULMI migration v19 — deletion feedback, blast idempotency,
--  server-side session-answer privacy. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Account deletion feedback (survives the profile delete; no PII/FK).
-- -------------------------------------------------------------
create table if not exists public.account_deletions (
  id         uuid primary key default gen_random_uuid(),
  reason     text,
  detail     text,
  created_at timestamptz not null default now()
);
alter table public.account_deletions enable row level security;

drop policy if exists "Anyone can log their deletion" on public.account_deletions;
create policy "Anyone can log their deletion" on public.account_deletions
  for insert to authenticated with check (true);

drop policy if exists "Admins read deletions" on public.account_deletions;
create policy "Admins read deletions" on public.account_deletions
  for select to authenticated using (public.is_admin());

-- -------------------------------------------------------------
-- Email-blast idempotency: records who a given campaign already reached so a
-- retry of the same content never double-sends. Written by the Edge Function.
-- -------------------------------------------------------------
create table if not exists public.broadcast_sends (
  campaign   text not null,
  email      text not null,
  sent_at    timestamptz not null default now(),
  primary key (campaign, email)
);
alter table public.broadcast_sends enable row level security;
-- No client policies — only the service-role Edge Function touches this.

-- -------------------------------------------------------------
-- H1: session answers are now readable server-side ONLY as your own rows,
-- or the partner's once BOTH have finished. (Was client-only before.)
-- -------------------------------------------------------------
drop policy if exists "View session answers" on public.session_answers;
create policy "View session answers" on public.session_answers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.both_answered(sess uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare s public.sessions; qn int; c1 int; c2 int;
begin
  select * into s from public.sessions where id = sess;
  if s.id is null then return false; end if;
  qn := coalesce(array_length(s.questions, 1), 8);
  select count(*) into c1 from public.session_answers where session_id = sess and user_id = s.user1_id;
  select count(*) into c2 from public.session_answers where session_id = sess and user_id = s.user2_id;
  return c1 >= qn and c2 >= qn;
end $$;

-- Returns my answers always; the partner's only once both have finished.
create or replace function public.get_session_answers(sess uuid)
returns table(user_id uuid, question_index int, answer text, answer_audio text)
language plpgsql stable security definer set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sess;
  if s.id is null or (auth.uid() <> s.user1_id and auth.uid() <> s.user2_id and not public.is_admin()) then
    return;
  end if;
  if public.both_answered(sess) or public.is_admin() then
    return query select a.user_id, a.question_index, a.answer, a.answer_audio
      from public.session_answers a where a.session_id = sess;
  else
    return query select a.user_id, a.question_index, a.answer, a.answer_audio
      from public.session_answers a where a.session_id = sess and a.user_id = auth.uid();
  end if;
end $$;
grant execute on function public.get_session_answers(uuid) to authenticated;

-- Per-user answered COUNTS (numbers only, no content) so the client can detect
-- "both finished" without reading the partner's answers.
create or replace function public.session_progress(sess uuid)
returns table(uid uuid, answered int)
language sql stable security definer set search_path = public as $$
  select a.user_id, count(*)::int
  from public.session_answers a
  join public.sessions s on s.id = a.session_id
  where a.session_id = sess and (s.user1_id = auth.uid() or s.user2_id = auth.uid() or public.is_admin())
  group by a.user_id;
$$;
grant execute on function public.session_progress(uuid) to authenticated;

notify pgrst, 'reload schema';


-- >>> migration_v20.sql
-- =============================================================
--  KULMI migration v20 — lifestyle & values fields. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists smoking text;
alter table public.profiles add column if not exists khat text;
alter table public.profiles add column if not exists religious_dress text; -- hijab (sisters) / beard (brothers)
alter table public.profiles add column if not exists open_to_polygyny text;

-- Rebuild the public view to expose the new lifestyle fields to other members.
drop view if exists public.public_profiles;
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


-- >>> migration_v21.sql
-- =============================================================
--  KULMI migration v21 — production-audit security fixes. Idempotent.
--  C2 invitation consent bypass · H1 email spoof / wali snooping ·
--  H2 ban + preserve moderation history · H4 private intros ·
--  M2 report constraints · M4 status race · M5 row re-pointing.
-- =============================================================

-- -------------------------------------------------------------
-- C2: a receiver could rewrite sender_id on an invitation and force a
-- session with any user (consent bypass). Lock updates to `status` only,
-- and pin the pair with a trigger (belt and braces).
-- -------------------------------------------------------------
revoke update on public.invitations from authenticated;
grant update (status) on public.invitations to authenticated;

create or replace function public.pin_invitation_pair()
returns trigger language plpgsql as $$
begin
  new.sender_id := old.sender_id;
  new.receiver_id := old.receiver_id;
  return new;
end $$;
drop trigger if exists trg_pin_invitation_pair on public.invitations;
create trigger trg_pin_invitation_pair before update on public.invitations
  for each row execute function public.pin_invitation_pair();

-- -------------------------------------------------------------
-- H1: a user could set profiles.email to someone's wali_email and read their
-- private chats (my_email/is_ward trusted the profile column). Fix both ends:
-- my_email() now trusts ONLY the verified login email from the JWT, and the
-- guard trigger pins profiles.email for non-admins.
-- -------------------------------------------------------------
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select auth.jwt() ->> 'email';
$$;

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- server / SQL editor: allow
  if public.is_admin() then return new; end if;    -- admins: allow anything
  -- everyone else: cannot change privileged fields
  if tg_op = 'UPDATE' then
    new.email := old.email;                        -- email is identity: pinned
    new.role := coalesce(old.role, 'user');
    new.photo_verified := coalesce(old.photo_verified, false);
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      new.verification_status := old.verification_status;
    end if;
  else
    new.email := coalesce(auth.jwt() ->> 'email', new.email); -- insert: your real login email
    new.role := 'user';
    new.photo_verified := false;
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;
  return new;
end $$;

-- -------------------------------------------------------------
-- H2a: deleting a user must NOT erase reports about them (moderation trail).
-- -------------------------------------------------------------
alter table public.reports alter column reporter_id drop not null;
alter table public.reports alter column reported_id drop not null;
do $$ begin
  alter table public.reports drop constraint if exists reports_reporter_id_fkey;
  alter table public.reports add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references public.profiles(id) on delete set null;
  alter table public.reports drop constraint if exists reports_reported_id_fkey;
  alter table public.reports add constraint reports_reported_id_fkey
    foreign key (reported_id) references public.profiles(id) on delete set null;
exception when others then null; end $$;

-- -------------------------------------------------------------
-- H2b: real ban — a banned email cannot create a profile again.
-- (Rows are written by the admin Edge function with the ban reason.)
-- -------------------------------------------------------------
create table if not exists public.banned_emails (
  email      text primary key,
  reason     text,
  banned_at  timestamptz not null default now()
);
alter table public.banned_emails enable row level security;
drop policy if exists "Admins read bans" on public.banned_emails;
create policy "Admins read bans" on public.banned_emails for select to authenticated
  using (public.is_admin());

create or replace function public.block_banned_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and exists (
    select 1 from public.banned_emails b where lower(b.email) = lower(new.email)
  ) then
    raise exception 'This account has been removed from Kulmi and cannot be re-registered.';
  end if;
  return new;
end $$;
drop trigger if exists trg_block_banned on public.profiles;
create trigger trg_block_banned before insert on public.profiles
  for each row execute function public.block_banned_signup();

-- -------------------------------------------------------------
-- H4: voice intros move to the PRIVATE bucket (category 'intro').
-- Readable by: owner, admins, a match — or anyone signed-in IF the owner set
-- their intro to public. (Old public-URL intros keep working via passthrough.)
-- -------------------------------------------------------------
drop policy if exists "Secure read gated" on storage.objects;
create policy "Secure read gated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'secure' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or (
        (storage.foldername(name))[2] in ('gallery', 'voice')
        and exists (select 1 from public.chats c
          where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
             or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'answer'
        and exists (select 1 from public.sessions s
          where (s.user1_id = auth.uid() and s.user2_id = ((storage.foldername(name))[1])::uuid)
             or (s.user2_id = auth.uid() and s.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'intro'
        and (
          exists (select 1 from public.profiles p
            where p.id = ((storage.foldername(name))[1])::uuid and p.intro_public = true)
          or exists (select 1 from public.chats c
            where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
               or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
        )
      )
    )
  );

-- -------------------------------------------------------------
-- M2: report hygiene — sane length, one open report per pair.
-- -------------------------------------------------------------
do $$ begin
  alter table public.reports add constraint reports_reason_len
    check (char_length(reason) between 3 and 2000) not valid;
exception when others then null; end $$;
do $$ begin
  create unique index reports_open_pair_uniq on public.reports (reporter_id, reported_id)
    where status = 'pending';
exception when others then null; end $$;

-- -------------------------------------------------------------
-- M4: serialize the both-agree success confirmation (no missed 'married').
-- -------------------------------------------------------------
create or replace function public.handle_chat_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.chats; cnt int;
begin
  perform pg_advisory_xact_lock(hashtext(new.chat_id::text));
  select * into s from public.chats where id = new.chat_id;
  if s.id is null then return new; end if;
  if new.status in ('engaged', 'married') then
    select count(distinct user_id) into cnt from public.chat_status
      where chat_id = new.chat_id and status = new.status and user_id in (s.user1_id, s.user2_id);
    if cnt >= 2 then
      update public.chats set confirmed_status = new.status, confirmed_at = now() where id = s.id;
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- M5: rows can't be re-pointed at other sessions/chats/users on update.
-- -------------------------------------------------------------
create or replace function public.pin_session_answer()
returns trigger language plpgsql as $$
begin
  new.session_id := old.session_id;
  new.user_id := old.user_id;
  new.question_index := old.question_index;
  return new;
end $$;
drop trigger if exists trg_pin_session_answer on public.session_answers;
create trigger trg_pin_session_answer before update on public.session_answers
  for each row execute function public.pin_session_answer();

create or replace function public.pin_chat_status()
returns trigger language plpgsql as $$
begin
  new.chat_id := old.chat_id;
  new.user_id := old.user_id;
  return new;
end $$;
drop trigger if exists trg_pin_chat_status on public.chat_status;
create trigger trg_pin_chat_status before update on public.chat_status
  for each row execute function public.pin_chat_status();

notify pgrst, 'reload schema';


-- >>> migration_v22.sql
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

drop view if exists public.public_profiles;
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

notify pgrst, 'reload schema';


-- >>> migration_v23.sql
-- =============================================================
--  KULMI migration v23 — normalise gender so opposite-gender-only
--  discovery is reliable. Idempotent.
-- =============================================================

-- Collapse any legacy / mixed-case / variant gender labels down to the two
-- canonical lowercase values the app matches on. Anything unrecognised is left
-- as-is (and simply won't appear as a match until corrected).
update public.profiles
set gender = case
  when lower(trim(gender)) in ('male', 'man', 'brother', 'boy', 'm')   then 'male'
  when lower(trim(gender)) in ('female', 'woman', 'sister', 'girl', 'f') then 'female'
  else gender
end
where gender is not null
  and gender <> case
    when lower(trim(gender)) in ('male', 'man', 'brother', 'boy', 'm')   then 'male'
    when lower(trim(gender)) in ('female', 'woman', 'sister', 'girl', 'f') then 'female'
    else gender
  end;

notify pgrst, 'reload schema';


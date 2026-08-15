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

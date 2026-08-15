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

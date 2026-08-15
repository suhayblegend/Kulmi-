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

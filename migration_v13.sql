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

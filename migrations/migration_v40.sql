-- =============================================================
--  KULMI migration v40 — working read receipts. Idempotent.
--  Adds messages.read_at and a definer function to mark a chat read. The
--  reader's own "read_receipts" preference is respected: if they turned it off,
--  their reads are never recorded, so the sender never sees "Read".
-- =============================================================

alter table public.messages add column if not exists read_at timestamptz;

create or replace function public.mark_chat_read(c uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Caller must be a participant in the chat.
  if not exists (
    select 1 from public.chats
    where id = c and (user1_id = auth.uid() or user2_id = auth.uid())
  ) then
    return;
  end if;

  -- Respect the reader's privacy toggle: only broadcast reads if it's on.
  if (select coalesce(read_receipts, true) from public.profiles where id = auth.uid()) then
    update public.messages
    set read_at = now()
    where chat_id = c and sender_id <> auth.uid() and read_at is null;
  end if;
end $$;

grant execute on function public.mark_chat_read(uuid) to authenticated;

notify pgrst, 'reload schema';

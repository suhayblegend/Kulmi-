-- =============================================================
--  KULMI migration v6 — success tracking (engagements / marriages)
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--
--  Each partner sets a relationship status in their chat. When BOTH set the
--  same status of 'engaged' or 'married', the chat is confirmed as a success
--  and counted (admins see the totals).
-- =============================================================

alter table public.chats add column if not exists confirmed_status text;
alter table public.chats add column if not exists confirmed_at     timestamptz;

create table if not exists public.chat_status (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null check (status in ('still_getting_to_know','exclusive','engaged','married','ended')),
  updated_at timestamptz not null default now(),
  unique (chat_id, user_id)
);
alter table public.chat_status enable row level security;

drop policy if exists "View chat status" on public.chat_status;
create policy "View chat status" on public.chat_status for select to authenticated
  using (
    exists (select 1 from public.chats c where c.id = chat_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid()))
    or public.is_admin()
  );

drop policy if exists "Set own chat status" on public.chat_status;
create policy "Set own chat status" on public.chat_status for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.chats c where c.id = chat_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
  ));

drop policy if exists "Update own chat status" on public.chat_status;
create policy "Update own chat status" on public.chat_status for update to authenticated
  using (user_id = auth.uid());

-- Both partners agree on engaged/married → confirm the success on the chat.
create or replace function public.handle_chat_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.chats; cnt int;
begin
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

drop trigger if exists on_chat_status on public.chat_status;
create trigger on_chat_status
  after insert or update on public.chat_status
  for each row execute function public.handle_chat_status();

notify pgrst, 'reload schema';

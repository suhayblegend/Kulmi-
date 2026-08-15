-- =============================================================
--  KULMI — compatibility sessions (the guided Q&A that gates a match)
--  Run in the Supabase SQL editor AFTER migration.sql. Idempotent.
--
--  New flow:
--    A invites B  ->  B accepts  ->  a SESSION is created (not a chat)
--    both answer the questions  ->  each makes a PRIVATE yes/no decision
--    both say yes  ->  the chat is created (profiles "unlock")
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tables
-- -------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  user1_id      uuid not null references public.profiles(id) on delete cascade, -- least(uid)
  user2_id      uuid not null references public.profiles(id) on delete cascade, -- greatest(uid)
  status        text not null default 'active' check (status in ('active','completed','ended')),
  created_at    timestamptz not null default now(),
  unique (user1_id, user2_id)
);

create table if not exists public.session_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  question_index int  not null,
  answer         text not null,
  created_at     timestamptz not null default now(),
  unique (session_id, user_id, question_index)
);

create table if not exists public.session_decisions (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  decision   text not null check (decision in ('yes','no')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.sessions          enable row level security;
alter table public.session_answers   enable row level security;
alter table public.session_decisions enable row level security;

-- -------------------------------------------------------------
-- 2. RLS
-- -------------------------------------------------------------
-- Sessions: participants (or admin) can read. Rows are created by a trigger.
drop policy if exists "View own sessions" on public.sessions;
create policy "View own sessions" on public.sessions for select to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id or public.is_admin());

-- Answers: any participant of the session can read all answers in it
-- (the client only reveals the partner's answers once both have finished).
drop policy if exists "View session answers" on public.session_answers;
create policy "View session answers" on public.session_answers for select to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid() or public.is_admin())
  ));

drop policy if exists "Write own answers" on public.session_answers;
create policy "Write own answers" on public.session_answers for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

drop policy if exists "Update own answers" on public.session_answers;
create policy "Update own answers" on public.session_answers for update to authenticated
  using (user_id = auth.uid());

-- Decisions are PRIVATE: you can only read your own (the outcome is applied by a trigger).
drop policy if exists "View own decision" on public.session_decisions;
create policy "View own decision" on public.session_decisions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Write own decision" on public.session_decisions;
create policy "Write own decision" on public.session_decisions for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
  ));

create index if not exists session_answers_idx on public.session_answers (session_id, user_id);

-- -------------------------------------------------------------
-- 3. Invitation accepted  ->  create a SESSION (replaces the old
--    "create a chat" behaviour from migration.sql)
-- -------------------------------------------------------------
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(new.sender_id, new.receiver_id);
  b uuid := greatest(new.sender_id, new.receiver_id);
begin
  if new.status = 'accepted' and coalesce(old.status,'') <> 'accepted' then
    if not exists (select 1 from public.sessions where user1_id = a and user2_id = b) then
      insert into public.sessions (invitation_id, user1_id, user2_id) values (new.id, a, b);
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 4. Both decisions = yes  ->  create the chat + complete session
-- -------------------------------------------------------------
create or replace function public.handle_session_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  yes_count int;
begin
  select * into s from public.sessions where id = new.session_id;
  if s.id is null then return new; end if;

  if new.decision = 'no' then
    update public.sessions set status = 'ended' where id = s.id and status = 'active';
    return new;
  end if;

  select count(*) into yes_count from public.session_decisions
    where session_id = s.id and decision = 'yes' and user_id in (s.user1_id, s.user2_id);

  if yes_count >= 2 then
    if not exists (
      select 1 from public.chats
      where least(user1_id, user2_id) = s.user1_id and greatest(user1_id, user2_id) = s.user2_id
    ) then
      insert into public.chats (user1_id, user2_id) values (s.user1_id, s.user2_id);
    end if;
    update public.sessions set status = 'completed' where id = s.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_session_decision on public.session_decisions;
create trigger on_session_decision
  after insert on public.session_decisions
  for each row execute function public.handle_session_decision();

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

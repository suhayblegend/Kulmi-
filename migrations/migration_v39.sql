-- =============================================================
--  KULMI migration v39 — keep compatibility questions in sync. Idempotent.
--  A session snapshots the initiator's (sender's) questions when the invite is
--  accepted. If the sender later edits/reorders their questions BEFORE anyone
--  has answered, the session should reflect that. Clients can't read another
--  member's compat_questions (RLS), so this SECURITY DEFINER function does it.
-- =============================================================

create or replace function public.sync_session_questions(sess uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  snd uuid;
  qs text[];
  answered int;
begin
  -- Only a participant may trigger a sync, and only for their own session.
  select i.sender_id into snd
  from public.sessions s
  join public.invitations i on i.id = s.invitation_id
  where s.id = sess and (s.user1_id = auth.uid() or s.user2_id = auth.uid());
  if snd is null then return; end if;

  -- Never change the question set once answering has begun (keeps answer
  -- indices aligned for both people).
  select count(*) into answered from public.session_answers where session_id = sess;
  if answered > 0 then return; end if;

  select compat_questions into qs from public.profiles where id = snd;
  if qs is not null and array_length(qs, 1) >= 1 then
    update public.sessions set questions = qs
    where id = sess and questions is distinct from qs;
  end if;
end $$;

grant execute on function public.sync_session_questions(uuid) to authenticated;

notify pgrst, 'reload schema';

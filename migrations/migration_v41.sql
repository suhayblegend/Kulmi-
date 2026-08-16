-- =============================================================
--  KULMI migration v41 — push edited compat questions to pending sessions.
--  Idempotent. Runs as the SENDER at save-time (most reliable): any session
--  they initiated (via their invitation) that hasn't been answered yet gets
--  their latest question set immediately.
-- =============================================================

create or replace function public.push_my_compat_questions()
returns void language plpgsql security definer set search_path = public as $$
declare
  qs text[];
begin
  select compat_questions into qs from public.profiles where id = auth.uid();
  if qs is null or array_length(qs, 1) is null then
    return; -- nothing custom to push (defaults stay in place)
  end if;

  update public.sessions s
  set questions = qs
  from public.invitations i
  where i.id = s.invitation_id
    and i.sender_id = auth.uid()
    and not exists (select 1 from public.session_answers a where a.session_id = s.id);
end $$;

grant execute on function public.push_my_compat_questions() to authenticated;

notify pgrst, 'reload schema';

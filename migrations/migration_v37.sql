-- =============================================================
--  KULMI migration v37 — anti-ghosting "48h ice-breaker". Idempotent.
--  When a match opens, BOTH people must send a first message within 48h
--  or the match quietly closes and frees both. Once both have spoken the
--  window is lifted for good (ice_deadline -> null).
-- =============================================================

alter table public.chats add column if not exists ice_deadline timestamptz;
alter table public.chats add column if not exists status text not null default 'active';

-- New chats get a 48h window from creation. Backfill existing chats:
--  * if both people already messaged  -> no window (null), it's a live match
--  * otherwise                        -> a fresh 48h grace from now, so no
--    existing conversation is closed retroactively.
update public.chats c
set ice_deadline = case
    when (select count(distinct m.sender_id) from public.messages m where m.chat_id = c.id) >= 2
      then null
    else now() + interval '48 hours'
  end
where c.ice_deadline is null and c.status = 'active';

-- Give the column a default so future inserts (via the accept trigger) get a
-- window automatically without touching that trigger.
alter table public.chats alter column ice_deadline set default (now() + interval '48 hours');

-- -------------------------------------------------------------
-- On every message: block posting into a closed match, and once the OTHER
-- side has already spoken, lift the ice window permanently.
-- -------------------------------------------------------------
create or replace function public.chat_ice_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.chats c where c.id = new.chat_id and c.status = 'expired') then
    raise exception 'This match has closed because it went quiet. Please connect with someone new.';
  end if;
  -- If there is already a message from the other person, both sides have now
  -- spoken with this insert — the match is alive, remove the deadline.
  if exists (
    select 1 from public.messages m
    where m.chat_id = new.chat_id and m.sender_id <> new.sender_id
  ) then
    update public.chats set ice_deadline = null
    where id = new.chat_id and ice_deadline is not null;
  end if;
  return new;
end $$;

drop trigger if exists trg_chat_ice_progress on public.messages;
create trigger trg_chat_ice_progress before insert on public.messages
  for each row execute function public.chat_ice_progress();

-- -------------------------------------------------------------
-- Sweep stale (ghosted) matches. Any authenticated member loading their
-- inbox calls this best-effort, so no cron is needed. A match expires only
-- if its window has passed and both sides have not yet spoken.
-- -------------------------------------------------------------
create or replace function public.expire_stale_chats()
returns void language sql security definer set search_path = public as $$
  update public.chats
  set status = 'expired'
  where status = 'active'
    and ice_deadline is not null
    and ice_deadline < now();
$$;
grant execute on function public.expire_stale_chats() to authenticated;

notify pgrst, 'reload schema';

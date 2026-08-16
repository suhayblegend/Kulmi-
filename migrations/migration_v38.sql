-- =============================================================
--  KULMI migration v38 — "Refer someone" (word-of-mouth growth). Idempotent.
--  Members privately nominate a serious person they know; Kulmi sends a warm
--  invite. The referrer stays anonymous unless they choose to be named.
-- =============================================================

create table if not exists public.referrals (
  id           uuid primary key default uuid_generate_v4(),
  referrer_id  uuid references public.profiles(id) on delete set null,
  name         text not null,
  email        text not null,
  reveal_name  boolean not null default false,
  note         text,
  status       text not null default 'sent',   -- sent | joined
  joined_at    timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.referrals enable row level security;

-- A member can create referrals only as themselves, and read only their own.
drop policy if exists "Create own referrals" on public.referrals;
create policy "Create own referrals" on public.referrals for insert to authenticated
  with check (referrer_id = auth.uid());

drop policy if exists "View own referrals" on public.referrals;
create policy "View own referrals" on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or public.is_admin());

-- Spam guard: cap referrals per member (10/day) and stop duplicate emails.
create or replace function public.throttle_referrals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.referrals
      where referrer_id = new.referrer_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have sent several invitations today — please try again tomorrow.';
  end if;
  if exists (select 1 from public.referrals
      where referrer_id = new.referrer_id and lower(email) = lower(new.email)) then
    raise exception 'You have already invited this person.';
  end if;
  return new;
end $$;

drop trigger if exists trg_throttle_referrals on public.referrals;
create trigger trg_throttle_referrals before insert on public.referrals
  for each row execute function public.throttle_referrals();

notify pgrst, 'reload schema';

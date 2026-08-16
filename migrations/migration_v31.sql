-- =============================================================
--  KULMI migration v31 — activity tracking for admin analytics.
-- =============================================================

alter table public.profiles add column if not exists last_active_at timestamptz;

-- Members stamp their own last-active time via this function (called on app
-- load). SECURITY DEFINER so it isn't affected by the profile guard trigger.
create or replace function public.touch_last_active()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_active_at = now() where id = auth.uid();
$$;
grant execute on function public.touch_last_active() to authenticated;

create index if not exists profiles_last_active_idx on public.profiles (last_active_at);
create index if not exists profiles_created_idx on public.profiles (created_at);

notify pgrst, 'reload schema';

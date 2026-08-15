-- =============================================================
--  KULMI migration v25 — blog posts (admin-authored). Idempotent.
-- =============================================================

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  excerpt    text,
  content    text not null,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Anyone (even logged out) can read published posts; admins see all.
drop policy if exists "Read published posts" on public.posts;
create policy "Read published posts" on public.posts for select
  to anon, authenticated using (published = true or public.is_admin());

drop policy if exists "Admins manage posts" on public.posts;
create policy "Admins manage posts" on public.posts for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_post_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_posts_touch on public.posts;
create trigger trg_posts_touch before update on public.posts
  for each row execute function public.touch_post_updated_at();

notify pgrst, 'reload schema';

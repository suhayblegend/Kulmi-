-- =============================================================
--  KULMI migration v15 — wali login fix + contact messages. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Wali fix: a guardian may not have a member profile row, so resolve their
-- email from the JWT as a fallback. This makes get_my_wards()/is_ward() work
-- for a wali who only has an auth account.
-- -------------------------------------------------------------
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select email from public.profiles where id = auth.uid()),
    auth.jwt() ->> 'email'
  );
$$;

-- -------------------------------------------------------------
-- Contact form: anyone (even logged-out) can send a message; only admins read.
-- -------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can send a contact message" on public.contact_messages;
create policy "Anyone can send a contact message" on public.contact_messages
  for insert to anon, authenticated with check (char_length(message) between 1 and 5000);

drop policy if exists "Admins read contact messages" on public.contact_messages;
create policy "Admins read contact messages" on public.contact_messages
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins update contact messages" on public.contact_messages;
create policy "Admins update contact messages" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists contact_messages_idx on public.contact_messages (handled, created_at desc);

notify pgrst, 'reload schema';

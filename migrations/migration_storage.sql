-- =============================================================
--  KULMI — storage setup for profile photos
--  Run ONCE in the Supabase SQL editor (after migration.sql).
--  Idempotent: safe to re-run.
-- =============================================================

-- Public bucket for avatars (anyone can view; only the owner can write).
-- Non-fatal: some projects block direct bucket inserts on re-run. Create the
-- bucket in the Dashboard if this is skipped; the rest of the setup still applies.
do $$ begin
  insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
exception when others then null; end $$;

-- Files are stored under  avatars/<user-id>/<filename>
-- so (storage.foldername(name))[1] == the owner's uid.

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

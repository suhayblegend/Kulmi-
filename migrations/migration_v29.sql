-- =============================================================
--  KULMI migration v29 — blog cover images. Idempotent.
-- =============================================================

alter table public.posts add column if not exists image_url text;

-- Public bucket for blog cover images (anyone can view; only admins can write).
do $$ begin
  insert into storage.buckets (id, name, public) values ('blog', 'blog', true)
  on conflict (id) do nothing;
exception when others then null; end $$;

drop policy if exists "Blog images public read" on storage.objects;
create policy "Blog images public read" on storage.objects for select
  to anon, authenticated using (bucket_id = 'blog');

drop policy if exists "Admins write blog images" on storage.objects;
create policy "Admins write blog images" on storage.objects for insert
  to authenticated with check (bucket_id = 'blog' and public.is_admin());

drop policy if exists "Admins update blog images" on storage.objects;
create policy "Admins update blog images" on storage.objects for update
  to authenticated using (bucket_id = 'blog' and public.is_admin());

drop policy if exists "Admins delete blog images" on storage.objects;
create policy "Admins delete blog images" on storage.objects for delete
  to authenticated using (bucket_id = 'blog' and public.is_admin());

notify pgrst, 'reload schema';

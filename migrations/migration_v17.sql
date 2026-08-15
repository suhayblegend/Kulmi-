-- =============================================================
--  KULMI migration v17 — block duplicate / reused profile photos.
--  Each real person's main photo is unique across the platform, so a
--  stolen/stock/celebrity image can't be used on more than one account.
--  Idempotent.
-- =============================================================
alter table public.profiles add column if not exists photo_hash text;

-- Pre-existing duplicates (e.g. test accounts that reused one photo) would
-- block the unique index — keep the hash on the OLDEST account per photo and
-- clear it on the rest, so the index always builds.
update public.profiles p
set photo_hash = null
where photo_hash is not null
  and exists (
    select 1 from public.profiles q
    where q.photo_hash = p.photo_hash
      and q.id <> p.id
      and (q.created_at < p.created_at or (q.created_at = p.created_at and q.id < p.id))
  );

-- Two different accounts can't share the same main photo. (A user re-saving
-- their own same photo keeps their own row's value — no conflict.)
create unique index if not exists profiles_photo_hash_uniq
  on public.profiles (photo_hash) where photo_hash is not null;

notify pgrst, 'reload schema';

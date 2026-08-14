-- =============================================================
--  KULMI migration v17 — block duplicate / reused profile photos.
--  Each real person's main photo is unique across the platform, so a
--  stolen/stock/celebrity image can't be used on more than one account.
--  Idempotent.
-- =============================================================
alter table public.profiles add column if not exists photo_hash text;

-- Two different accounts can't share the same main photo. (A user re-saving
-- their own same photo keeps their own row's value — no conflict.)
create unique index if not exists profiles_photo_hash_uniq
  on public.profiles (photo_hash) where photo_hash is not null;

notify pgrst, 'reload schema';

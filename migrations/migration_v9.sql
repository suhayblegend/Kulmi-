-- =============================================================
--  KULMI migration v9 — auto-detected location coordinates
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--  Coordinates are PRIVATE (not in the public view) — only city/country show.
-- =============================================================

alter table public.profiles add column if not exists latitude  double precision;
alter table public.profiles add column if not exists longitude double precision;

notify pgrst, 'reload schema';

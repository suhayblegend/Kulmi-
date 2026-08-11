-- =============================================================
--  KULMI migration v8 — collect last name at signup
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--  last_name is kept private (not in the public view) — others see first name only.
-- =============================================================

alter table public.profiles add column if not exists last_name text;

notify pgrst, 'reload schema';

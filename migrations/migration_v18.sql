-- =============================================================
--  KULMI migration v18 — verification rejection reason. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists verification_note text;

notify pgrst, 'reload schema';

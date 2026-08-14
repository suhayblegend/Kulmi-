-- =============================================================
--  KULMI migration v16 — email unsubscribe. Idempotent.
-- =============================================================
alter table public.profiles add column if not exists email_unsubscribed boolean not null default false;

notify pgrst, 'reload schema';

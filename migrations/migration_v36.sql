-- =============================================================
--  KULMI migration v36 — re-engagement email support. Idempotent.
--  last_reengage_email_at: caps invitation emails to ~1/day per person.
--  chats.match_emailed: ensures the "it's a match" email is sent once.
-- =============================================================

alter table public.profiles add column if not exists last_reengage_email_at timestamptz;
alter table public.chats add column if not exists match_emailed boolean not null default false;

notify pgrst, 'reload schema';

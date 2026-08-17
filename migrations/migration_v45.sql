-- =============================================================
--  KULMI migration v45 — throttle marker for new-message push. Idempotent.
--  One push per chat per ~30 min so an active conversation doesn't spam.
-- =============================================================

alter table public.chats add column if not exists last_msg_push_at timestamptz;

notify pgrst, 'reload schema';

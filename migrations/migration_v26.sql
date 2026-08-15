-- =============================================================
--  KULMI migration v26 — audit fixes. Idempotent.
--  Pin wali_confirmed (a member could self-confirm their wali via
--  the API) and photo_hash-when-photo-unchanged in the guard.
-- =============================================================

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- server / SQL editor: allow
  if public.is_admin() then return new; end if;    -- admins: allow anything
  if tg_op = 'UPDATE' then
    new.email := old.email;                        -- email is identity: pinned
    new.role := coalesce(old.role, 'user');
    new.photo_verified := coalesce(old.photo_verified, false);
    -- Wali confirmation can ONLY be set by the emailed link (service role).
    -- (trg_reset_wali_confirm still resets it when wali_email changes.)
    new.wali_confirmed := coalesce(old.wali_confirmed, false);
    -- The anti-duplicate photo hash can't be cleared while keeping the photo.
    if new.profile_picture_url is not distinct from old.profile_picture_url then
      new.photo_hash := old.photo_hash;
    end if;
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      new.verification_status := old.verification_status;
    end if;
  else
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    new.role := 'user';
    new.photo_verified := false;
    new.wali_confirmed := false;                   -- never born confirmed
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

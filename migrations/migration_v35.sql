-- =============================================================
--  KULMI migration v35 — SECURITY: pin billing columns on INSERT too.
--  Idempotent.
--
--  guard_profile_privileges pinned premium_until/founding_member on UPDATE but
--  not on INSERT, so after the founding window (1 Sep 2026) a member could
--  self-grant Kulmi+ by inserting a profile with a forged premium_until.
--  Pin them to null/false on insert; the founding trigger (runs after) still
--  re-applies the genuine offer during the window, and real premium can only
--  come from the service-role Stripe webhook / claim-founding path.
-- =============================================================

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- server / SQL editor: allow
  if public.is_admin() then return new; end if;    -- admins: allow anything
  if tg_op = 'UPDATE' then
    new.email := old.email;
    new.role := coalesce(old.role, 'user');
    new.photo_verified := coalesce(old.photo_verified, false);
    new.wali_confirmed := coalesce(old.wali_confirmed, false);
    new.plan := coalesce(old.plan, 'free');
    new.premium_until := old.premium_until;
    new.founding_member := coalesce(old.founding_member, false);
    new.stripe_customer_id := old.stripe_customer_id;
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
    new.wali_confirmed := false;
    new.plan := 'free';
    new.stripe_customer_id := null;
    new.premium_until := null;      -- billing can't be self-granted on insert
    new.founding_member := false;   -- (founding trigger re-applies in-window)
    if new.verification_status is distinct from 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

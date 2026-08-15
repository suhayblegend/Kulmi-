-- =============================================================
--  KULMI migration v5 — photo gallery with gated reveal
--  Run in the Supabase SQL editor AFTER the earlier migrations. Idempotent.
--
--  Everyone sees ONLY a member's main photo (profile_picture_url) in Discover.
--  The extra photos (gallery) are revealed ONLY to a matched partner (someone
--  who shares a chat with them) — the app's differentiator.
-- =============================================================

alter table public.profiles add column if not exists gallery text[] default '{}';

-- Returns a member's extra photos ONLY if the caller is matched with them
-- (i.e. they share a chat). Otherwise returns an empty array.
create or replace function public.get_gallery(target uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(p.gallery, '{}')
  from public.profiles p
  where p.id = target
    and exists (
      select 1 from public.chats c
      where (c.user1_id = auth.uid() and c.user2_id = target)
         or (c.user2_id = auth.uid() and c.user1_id = target)
    );
$$;
grant execute on function public.get_gallery(uuid) to authenticated;

-- NOTE: `gallery` is deliberately NOT added to the public_profiles view, so it
-- can never leak in discovery — extra photos are reachable only via get_gallery.

notify pgrst, 'reload schema';

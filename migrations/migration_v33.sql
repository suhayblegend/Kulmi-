-- =============================================================
--  KULMI migration v33 — fix public voice intros not loading for
--  other members. Idempotent.
--
--  The "Secure read gated" storage policy checked profiles.intro_public
--  with a subquery that runs under the VIEWER's RLS — but a member can't
--  read another member's profile row, so the check always failed and the
--  signed URL was denied. Use a SECURITY DEFINER helper for just that flag.
-- =============================================================

create or replace function public.intro_is_public(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select intro_public from public.profiles where id = owner), false);
$$;
grant execute on function public.intro_is_public(uuid) to authenticated;

drop policy if exists "Secure read gated" on storage.objects;
create policy "Secure read gated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'secure' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or (
        (storage.foldername(name))[2] in ('gallery', 'voice')
        and exists (select 1 from public.chats c
          where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
             or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'answer'
        and exists (select 1 from public.sessions s
          where (s.user1_id = auth.uid() and s.user2_id = ((storage.foldername(name))[1])::uuid)
             or (s.user2_id = auth.uid() and s.user1_id = ((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[2] = 'intro'
        and (
          public.intro_is_public(((storage.foldername(name))[1])::uuid)
          or exists (select 1 from public.chats c
            where (c.user1_id = auth.uid() and c.user2_id = ((storage.foldername(name))[1])::uuid)
               or (c.user2_id = auth.uid() and c.user1_id = ((storage.foldername(name))[1])::uuid))
        )
      )
    )
  );

notify pgrst, 'reload schema';

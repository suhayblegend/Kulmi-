-- =============================================================
--  KULMI migration v30 — blog reactions (❤ love / 🤲 ameen / 💡 helpful).
--  Lightweight, spam-resistant: counts only, no free text. Idempotent.
-- =============================================================

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  emoji   text not null,               -- 'love' | 'ameen' | 'helpful'
  count   int  not null default 0,
  primary key (post_id, emoji)
);
alter table public.post_reactions enable row level security;

-- Anyone can read counts; nobody writes directly (only via the function below).
drop policy if exists "Reactions public read" on public.post_reactions;
create policy "Reactions public read" on public.post_reactions
  for select to anon, authenticated using (true);

-- Increment a reaction on a PUBLISHED post. SECURITY DEFINER so anon readers
-- can react without any table write privilege; validates the reaction type.
create or replace function public.react_post(p_post uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_emoji not in ('love', 'ameen', 'helpful') then return; end if;
  if not exists (select 1 from public.posts where id = p_post and published = true) then return; end if;
  insert into public.post_reactions (post_id, emoji, count) values (p_post, p_emoji, 1)
  on conflict (post_id, emoji) do update set count = public.post_reactions.count + 1;
end $$;
grant execute on function public.react_post(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

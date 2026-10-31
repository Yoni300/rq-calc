-- Update 4: tags on public builds. Run once in Supabase: SQL Editor → New query → paste → Run.
-- A build can have up to 5 tags from a fixed list (the app shows them in the player's language).
-- The list is checked by the server, so nobody can add other words through a script.

alter table public.builds add column if not exists tags text[] not null default '{}';

alter table public.builds drop constraint if exists builds_tags_check;
alter table public.builds add constraint builds_tags_check check (
  cardinality(tags) <= 5 and tags <@ array[
    'pve', 'pvp', 'farm', 'solo', 'party', 'boss', 'tank', 'support',
    'dd', 'crit', 'dodge', 'budget', 'endgame', 'newbie', 'event', 'arena'
  ]::text[]
);

create index if not exists builds_tags_idx on public.builds using gin (tags);

-- players read the new column too (other columns are listed in 003-fair-likes.sql)
grant select (tags) on public.builds to anon, authenticated;

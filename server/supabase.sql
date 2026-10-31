-- Public builds for RQ Calc. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Players use the public (anon) key: they can read and publish builds, like them,
-- and delete only their own builds (proved by a secret token that never leaves their computer).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.builds (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 60),
  author      text not null default '' check (char_length(author) <= 30),
  description text not null default '' check (char_length(description) <= 500),
  class_id    int  not null,
  level       int  not null check (level between 1 and 100),
  dps         numeric,
  hp          numeric,
  ehp         numeric,
  data        jsonb not null check (pg_column_size(data) < 30000),
  likes       int  not null default 0,
  owner_hash  text not null check (char_length(owner_hash) = 64)
);
create index if not exists builds_created_idx on public.builds (created_at desc);
create index if not exists builds_likes_idx on public.builds (likes desc);
create index if not exists builds_class_idx on public.builds (class_id);

alter table public.builds enable row level security;

drop policy if exists "anyone can read builds" on public.builds;
create policy "anyone can read builds" on public.builds for select using (true);

drop policy if exists "anyone can publish a build" on public.builds;
create policy "anyone can publish a build" on public.builds for insert with check (likes = 0);

-- explicit rights (works whether or not "Automatically expose new tables" was enabled):
-- players may read and publish; no direct update/delete, only through the functions below
grant usage on schema public to anon, authenticated;
grant select, insert on public.builds to anon, authenticated;
revoke update, delete, truncate on public.builds from anon, authenticated;

-- like a build (+1)
create or replace function public.like_build(p_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.builds set likes = likes + 1 where id = p_id returning likes;
$$;

-- delete your own build: the token's sha256 must match the hash stored when publishing
create or replace function public.delete_build(p_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.builds where id = p_id and owner_hash = encode(digest(p_token, 'sha256'), 'hex');
  return found;
end;
$$;

grant execute on function public.like_build(uuid) to anon, authenticated;
grant execute on function public.delete_build(uuid, text) to anon, authenticated;

-- take back a like (−1, never below zero)
create or replace function public.unlike_build(p_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.builds set likes = greatest(likes - 1, 0) where id = p_id returning likes;
$$;
grant execute on function public.unlike_build(uuid) to anon, authenticated;

-- Update 3: fair likes. Run once in Supabase: SQL Editor → New query → paste → Run.
--
-- Before: the server added +1 / −1 for anyone who asked, and the app remembered "I already liked" on the PC.
-- Now the server remembers who liked what: one like per build per IP address, and only the
-- address that liked can take the like back. IPs are not stored, only a salted hash of them.
-- Also: at most 10 published builds per IP per day (stops spam scripts).
-- The function names stay the same, so already installed versions of the app follow the new rules too.

create extension if not exists pgcrypto with schema extensions;

-- random secret salt, readable only by the server's own functions
create table if not exists public.rqc_secret (id int primary key default 1 check (id = 1), salt text not null);
insert into public.rqc_secret (salt) values (encode(extensions.gen_random_bytes(32), 'hex')) on conflict (id) do nothing;
alter table public.rqc_secret enable row level security;
revoke all on public.rqc_secret from anon, authenticated;

-- who is asking: salted hash of the caller's IP (Supabase passes it in the request headers)
create or replace function public.rqc_voter()
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := coalesce(nullif(hdr->>'cf-connecting-ip', ''),
                      nullif(trim(split_part(hdr->>'x-forwarded-for', ',', 1)), ''),
                      nullif(hdr->>'x-real-ip', ''));
begin
  if ip is null then raise exception 'cannot identify the client'; end if;
  return encode(digest(ip || (select salt from public.rqc_secret where id = 1), 'sha256'), 'hex');
end;
$$;
revoke execute on function public.rqc_voter() from public, anon, authenticated;

-- who liked what
create table if not exists public.build_likes (
  build_id   uuid not null references public.builds (id) on delete cascade,
  voter      text not null,
  created_at timestamptz not null default now(),
  primary key (build_id, voter)
);
alter table public.build_likes enable row level security;
revoke all on public.build_likes from anon, authenticated;

-- old likes were counted without knowing who gave them, so start fresh
update public.builds set likes = 0 where likes <> 0;

-- like (+1), only once per voter
create or replace function public.like_build(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.build_likes (build_id, voter) values (p_id, public.rqc_voter()) on conflict do nothing;
  if found then update public.builds set likes = likes + 1 where id = p_id returning likes into n;
  else select likes into n from public.builds where id = p_id; end if;
  return n;
end;
$$;

-- take back your own like (−1)
create or replace function public.unlike_build(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.build_likes where build_id = p_id and voter = public.rqc_voter();
  if found then update public.builds set likes = greatest(likes - 1, 0) where id = p_id returning likes into n;
  else select likes into n from public.builds where id = p_id; end if;
  return n;
end;
$$;

-- builds I liked (so the heart is right on any PC with my address)
create or replace function public.my_likes()
returns setof uuid language sql stable security definer set search_path = public as $$
  select build_id from public.build_likes where voter = public.rqc_voter();
$$;

grant execute on function public.like_build(uuid), public.unlike_build(uuid), public.my_likes() to anon, authenticated;

-- at most 10 builds per IP per day
alter table public.builds add column if not exists publisher text;
create index if not exists builds_publisher_idx on public.builds (publisher, created_at);

create or replace function public.rqc_can_publish()
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) < 10 from public.builds where publisher = public.rqc_voter() and created_at > now() - interval '1 day';
$$;
grant execute on function public.rqc_can_publish() to anon, authenticated;

create or replace function public.rqc_set_publisher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.publisher := public.rqc_voter();
  new.likes := 0;
  return new;
end;
$$;
drop trigger if exists builds_set_publisher on public.builds;
create trigger builds_set_publisher before insert on public.builds for each row execute function public.rqc_set_publisher();

drop policy if exists "anyone can publish a build" on public.builds;
create policy "anyone can publish a build" on public.builds for insert with check (likes = 0 and public.rqc_can_publish());

-- the publisher hash is internal: players can read every column except it
revoke select on public.builds from anon, authenticated;
grant select (id, created_at, name, author, description, class_id, level, dps, hp, ehp, data, likes, owner_hash)
  on public.builds to anon, authenticated;

-- check: shows whether the server sees your address (true = OK). Safe to keep.
create or replace function public.rqc_check()
returns boolean language sql stable security definer set search_path = public as $$
  select public.rqc_voter() is not null;
$$;
grant execute on function public.rqc_check() to anon, authenticated;

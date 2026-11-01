-- Update 6: boss timer groups.
-- Everyone who knows a group code sees the same boss kill times. Codes are 8 random letters/digits made by the app.
-- Run once in Supabase → SQL Editor (safe to run again).

create table if not exists public.boss_kills (
  room text not null check (room ~ '^[A-Z0-9]{8}$'),
  boss text not null check (char_length(boss) between 1 and 120),
  killed_at timestamptz not null,
  by_name text check (char_length(by_name) <= 24),
  updated_at timestamptz not null default now(),
  primary key (room, boss)
);
alter table public.boss_kills enable row level security;
-- no policies: the table is reached only through the two functions below
revoke all on public.boss_kills from anon, authenticated;

create or replace function public.boss_room(p_room text)
returns table (boss text, killed_at timestamptz, by_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select k.boss, k.killed_at, k.by_name, k.updated_at from public.boss_kills k where k.room = upper(p_room);
$$;

-- p_killed_at = null clears the timer
create or replace function public.boss_set_kill(p_room text, p_boss text, p_killed_at timestamptz, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_killed_at is null then
    delete from public.boss_kills where room = upper(p_room) and boss = p_boss;
    return;
  end if;
  if p_killed_at > now() + interval '5 minutes' or p_killed_at < now() - interval '3 days' then
    raise exception 'bad kill time';
  end if;
  if (select count(*) from public.boss_kills where room = upper(p_room)) >= 150
     and not exists (select 1 from public.boss_kills where room = upper(p_room) and boss = p_boss) then
    raise exception 'too many timers in this group';
  end if;
  insert into public.boss_kills (room, boss, killed_at, by_name, updated_at)
  values (upper(p_room), p_boss, p_killed_at, nullif(left(trim(coalesce(p_by, '')), 24), ''), now())
  on conflict (room, boss) do update set killed_at = excluded.killed_at, by_name = excluded.by_name, updated_at = now();
  -- forgotten groups clean themselves up
  delete from public.boss_kills where updated_at < now() - interval '14 days';
end;
$$;

grant execute on function public.boss_room(text) to anon, authenticated;
grant execute on function public.boss_set_kill(text, text, timestamptz, text) to anon, authenticated;

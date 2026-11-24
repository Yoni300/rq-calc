-- Update 8: game status for the site (app/server-status.js).
-- Every minute Supabase itself asks two public sources and keeps the answers for 48 hours:
--   - players in the game now, from Steam (GetNumberOfCurrentPlayers, app 2962300);
--   - the game's maintenance switch, the one the launcher checks (BASE service-status for «rq»).
-- A web page can't ask them itself (no CORS), and GitHub runs scheduled jobs hours late, so the collecting lives here.
-- The site and the app read the last 24 hours through server_status_hist(). Nothing about players is stored.
-- Run once in Supabase → SQL Editor (safe to run again).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- one row per minute: players (Steam), can the game be started (BASE), BASE's list of statuses
create table if not exists public.server_status (
  at timestamptz primary key,
  online int,
  can_run boolean,
  statuses jsonb
);
alter table public.server_status enable row level security;
revoke all on public.server_status from anon, authenticated;

-- the requests sent a minute ago, waiting for their answers (pg_net answers in the background)
create table if not exists public.server_status_req (
  id bigint primary key,
  kind text not null,
  made_at timestamptz not null default now()
);
alter table public.server_status_req enable row level security;
revoke all on public.server_status_req from anon, authenticated;

create or replace function public.server_status_tick()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  j jsonb;
  m timestamptz;
begin
  -- the answers to the earlier requests
  for r in
    select q.id, q.kind, q.made_at, h.status_code, h.content
    from public.server_status_req q join net._http_response h on h.id = q.id
  loop
    begin
      m := date_trunc('minute', r.made_at);
      if r.status_code = 200 then
        j := r.content::jsonb;
        -- 0 players = Steam doesn't know right now (it answers 0 for every game during its own maintenance), not an empty game
        if r.kind = 'steam' and j -> 'response' ->> 'result' = '1' and (j -> 'response' ->> 'player_count')::int > 0 then
          insert into public.server_status (at, online) values (m, (j -> 'response' ->> 'player_count')::int)
          on conflict (at) do update set online = excluded.online;
        elsif r.kind = 'game' and j -> 'data' ? 'canRun' then
          insert into public.server_status (at, can_run, statuses)
          values (m, (j -> 'data' ->> 'canRun')::boolean, coalesce(j -> 'data' -> 'statuses', '[]'::jsonb))
          on conflict (at) do update set can_run = excluded.can_run, statuses = excluded.statuses;
        end if;
      end if;
    exception when others then
      null; -- a broken answer is skipped, the next minute brings a new one
    end;
    delete from public.server_status_req where id = r.id;
  end loop;
  delete from public.server_status_req where made_at < now() - interval '10 minutes'; -- never answered
  delete from public.server_status where at < now() - interval '48 hours';

  -- the next requests
  insert into public.server_status_req (id, kind) values
    (net.http_get('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=2962300&_=' || floor(extract(epoch from now()))::bigint), 'steam'),
    (net.http_get(url := 'https://bffweb.baseplatform.online/api/servicecontrol/service-status/rq', headers := '{"X-Application": "SilentLauncher"}'::jsonb), 'game');
end;
$$;
revoke all on function public.server_status_tick() from public, anon, authenticated;

-- zeros saved by the first version of this file (Steam's maintenance) are "unknown", not "nobody"
update public.server_status set online = null where online = 0;

-- every minute
select cron.unschedule(jobid) from cron.job where jobname = 'server-status';
select cron.schedule('server-status', '* * * * *', 'select public.server_status_tick()');

-- the last 24 hours for the page: every minute of the last hour, older ones as 5-minute steps
-- (players: the average; can_run: false if the game was closed at any moment of the step)
create or replace function public.server_status_hist()
returns table (at timestamptz, online int, can_run boolean, statuses jsonb)
language sql stable security definer set search_path = public as $$
  select s.at, s.online, s.can_run, s.statuses
  from public.server_status s
  where s.at > now() - interval '1 hour'
  union all
  select date_bin('5 minutes', s.at, timestamptz '2000-01-01'), round(avg(nullif(s.online, 0)))::int, bool_and(s.can_run), null
  from public.server_status s
  where s.at > now() - interval '24 hours' and s.at <= now() - interval '1 hour'
  group by 1
  order by 1;
$$;
grant execute on function public.server_status_hist() to anon, authenticated;

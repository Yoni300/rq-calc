-- Update 8: market prices. The app's market scanner reads the in-game market from the screen and sends
-- "item · price" for every lot it sees; the site and the app show current prices and their history.
-- Items are wiki page ids from data/market-items.js. Server: fenix | helios | solus.
-- Run once in Supabase → SQL Editor (safe to run again). Uses rqc_voter() from 003-fair-likes.sql.

create table if not exists public.market_obs (
  id bigint generated always as identity primary key,
  server text not null check (server in ('fenix', 'helios', 'solus')),
  item int not null check (item > 0),
  price bigint not null check (price > 0 and price < 100000000000),
  seen_at timestamptz not null default now(),
  sender text not null                                   -- salted IP hash: rate limit and repeats only
);
create index if not exists market_obs_item on public.market_obs (server, item, seen_at desc);
create index if not exists market_obs_sender on public.market_obs (sender, seen_at desc);
alter table public.market_obs enable row level security;
revoke all on public.market_obs from anon, authenticated;

-- p_rows: [{"i": item, "p": price}, …] — one market page (up to 20 lots)
create or replace function public.market_submit(p_server text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  who text := public.rqc_voter();
  r jsonb; v_item int; v_price bigint; med numeric; added int := 0;
begin
  if p_server not in ('fenix', 'helios', 'solus') then raise exception 'unknown server'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20 then raise exception 'bad rows'; end if;
  -- one person can't flood the table: at most 600 prices per 10 minutes
  if (select count(*) from public.market_obs where sender = who and seen_at > now() - interval '10 minutes') >= 600 then
    raise exception 'too many prices, try again later';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_item := (r->>'i')::int; v_price := (r->>'p')::bigint;
    if v_item is null or v_price is null or v_price <= 0 then continue; end if;
    -- the same lot seen again by the same person within 30 minutes is not a new price
    if exists (select 1 from public.market_obs where server = p_server and item = v_item and price = v_price
               and sender = who and seen_at > now() - interval '30 minutes') then continue; end if;
    -- a misread price far from the usual one is dropped
    select percentile_cont(0.5) within group (order by price) into med from public.market_obs
      where server = p_server and item = v_item and seen_at > now() - interval '30 days';
    if med is not null and (v_price > med * 30 or v_price * 30 < med) then continue; end if;
    insert into public.market_obs (server, item, price, sender) values (p_server, v_item, v_price, who);
    added := added + 1;
  end loop;
  return added;
end;
$$;
grant execute on function public.market_submit(text, jsonb) to anon, authenticated;

-- every item seen on a server: the lowest price of its latest scan (within an hour of it), when that was,
-- the median of the last 7 days and how many prices that median is made of
create or replace function public.market_summary(p_server text)
returns table (item int, cur bigint, cur_at timestamptz, med7 bigint, n7 int)
language sql stable security definer set search_path = public as $$
  with last as (
    select o.item, max(o.seen_at) as at from public.market_obs o where o.server = p_server group by o.item
  ), cur as (
    select o.item, min(o.price) as cur, max(l.at) as cur_at from public.market_obs o join last l on l.item = o.item
    where o.server = p_server and o.seen_at > l.at - interval '1 hour' group by o.item
  ), wk as (
    select o.item, percentile_cont(0.5) within group (order by o.price)::bigint as med7, count(*)::int as n7
    from public.market_obs o where o.server = p_server and o.seen_at > now() - interval '7 days' group by o.item
  )
  select c.item, c.cur, c.cur_at, w.med7, coalesce(w.n7, 0) from cur c left join wk w on w.item = c.item;
$$;
grant execute on function public.market_summary(text) to anon, authenticated;

-- one item's history by day: lowest and median price, number of prices
create or replace function public.market_history(p_server text, p_item int, p_days int default 60)
returns table (day date, low bigint, med bigint, n int)
language sql stable security definer set search_path = public as $$
  select (o.seen_at at time zone 'UTC')::date, min(o.price), (percentile_cont(0.5) within group (order by o.price))::bigint, count(*)::int
  from public.market_obs o
  where o.server = p_server and o.item = p_item and o.seen_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  group by 1 order by 1;
$$;
grant execute on function public.market_history(text, int, int) to anon, authenticated;

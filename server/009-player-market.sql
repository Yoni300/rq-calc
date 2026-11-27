-- Update 9: «Рынок игроков» — players' buy and sell listings (equipment set up like in the calculator, and cards).
-- Each listing: server, sell or buy, the item with its upgrade / stamp / cards / personal flag, price in gold,
-- the character's nickname and an optional Discord name. Deals happen in the game; the site only shows who wants what.
--
-- Rules the server keeps:
--   * a listing lives 14 days, the author can renew it (another 14 days from now) or take it down;
--   * at most 30 active listings and at most 15 new ones per 10 minutes from one IP (salted hash, rqc_voter() from 003);
--   * only the device that posted a listing can change it: it keeps a random secret, the server stores its sha256;
--   * 3 reports from different IPs hide a listing. Reports: Supabase → Table Editor → market_reports;
--     to bring a listing back set market_lots.hidden = false, to remove it delete the row.
--   * listings expired more than 30 days ago are deleted.
-- Run once in Supabase → SQL Editor (safe to run again).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.market_lots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  server text not null check (server in ('fenix', 'helios')),
  side text not null check (side in ('sell', 'buy')),
  kind text not null check (kind in ('item', 'card')),
  item_id int not null check (item_id > 0),
  upgrade smallint not null default 0 check (upgrade between 0 and 20),
  stamp int check (stamp > 0),                                   -- stamp variant (stamp + color) id
  cards int[] not null default '{}' check (cardinality(cards) <= 4), -- 0 = empty card slot
  personal boolean not null default false,
  qty int not null default 1 check (qty between 1 and 9999),
  price bigint not null check (price between 1 and 1000000000000), -- gold, for one piece
  nick text not null check (char_length(nick) between 2 and 24),
  discord text check (char_length(discord) <= 40),
  owner text not null,                                           -- salted IP hash, only for the limits
  token text not null,                                           -- sha256 of the author's secret
  hidden boolean not null default false                          -- hidden by reports (or by hand)
);
create index if not exists market_lots_board on public.market_lots (server, expires_at);
create index if not exists market_lots_owner on public.market_lots (owner, expires_at);
alter table public.market_lots enable row level security;
revoke all on public.market_lots from anon, authenticated;

create table if not exists public.market_reports (
  lot_id bigint not null references public.market_lots (id) on delete cascade,
  reporter text not null,
  created_at timestamptz not null default now(),
  primary key (lot_id, reporter)
);
alter table public.market_reports enable row level security;
revoke all on public.market_reports from anon, authenticated;

-- the active listings of one server (no owner, no token)
create or replace function public.market_board(p_server text)
returns table (id bigint, created_at timestamptz, expires_at timestamptz, side text, kind text, item_id int, upgrade smallint,
               stamp int, cards int[], personal boolean, qty int, price bigint, nick text, discord text)
language sql stable security definer set search_path = public as $$
  select l.id, l.created_at, l.expires_at, l.side, l.kind, l.item_id, l.upgrade, l.stamp, l.cards, l.personal, l.qty, l.price, l.nick, l.discord
  from public.market_lots l
  where l.server = p_server and not l.hidden and l.expires_at > now()
  order by l.created_at desc
  limit 5000;
$$;

-- the author's own listings, also expired or hidden ones: ids and secrets the device keeps
create or replace function public.market_mine(p_ids bigint[], p_secrets text[])
returns table (id bigint, created_at timestamptz, expires_at timestamptz, server text, side text, kind text, item_id int, upgrade smallint,
               stamp int, cards int[], personal boolean, qty int, price bigint, nick text, discord text, hidden boolean)
language sql stable security definer set search_path = public, extensions as $$
  select l.id, l.created_at, l.expires_at, l.server, l.side, l.kind, l.item_id, l.upgrade, l.stamp, l.cards, l.personal, l.qty, l.price, l.nick, l.discord, l.hidden
  from unnest(p_ids[1:60], p_secrets[1:60]) as k(id, secret)
  join public.market_lots l on l.id = k.id and l.token = encode(digest(k.secret, 'sha256'), 'hex');
$$;

create or replace function public.market_add(p_server text, p_side text, p_kind text, p_item int, p_upgrade int, p_stamp int,
  p_cards int[], p_personal boolean, p_qty int, p_price bigint, p_nick text, p_discord text, p_secret text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  who text := public.rqc_voter();
  v_id bigint;
  v_exp timestamptz := now() + interval '14 days';
begin
  if p_secret is null or char_length(p_secret) < 16 then raise exception 'bad secret'; end if;
  if (select count(*) from public.market_lots where owner = who and expires_at > now()) >= 30 then
    raise exception 'market: too many listings';
  end if;
  if (select count(*) from public.market_lots where owner = who and created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'market: too fast';
  end if;
  if exists (select 1 from public.market_lots where owner = who and expires_at > now() and not hidden
      and server = p_server and side = p_side and kind = p_kind and item_id = p_item and upgrade = coalesce(p_upgrade, 0)
      and stamp is not distinct from p_stamp and cards = coalesce(p_cards, '{}') and personal = coalesce(p_personal, false)) then
    raise exception 'market: duplicate';
  end if;
  insert into public.market_lots (expires_at, server, side, kind, item_id, upgrade, stamp, cards, personal, qty, price, nick, discord, owner, token)
  values (v_exp, p_server, p_side, p_kind, p_item, coalesce(p_upgrade, 0), p_stamp, coalesce(p_cards, '{}'), coalesce(p_personal, false),
          coalesce(p_qty, 1), p_price, trim(p_nick), nullif(trim(coalesce(p_discord, '')), ''), who, encode(digest(p_secret, 'sha256'), 'hex'))
  returning market_lots.id into v_id;
  delete from public.market_lots where expires_at < now() - interval '30 days';
  return json_build_object('id', v_id, 'expires_at', v_exp);
end;
$$;

-- renew (p_renew), change the price / count, or take down (p_delete); only with the listing's secret
create or replace function public.market_edit(p_id bigint, p_secret text, p_price bigint, p_qty int, p_renew boolean, p_delete boolean)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  h text := encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex');
  v_exp timestamptz;
begin
  if not exists (select 1 from public.market_lots where id = p_id and token = h) then raise exception 'market: not yours'; end if;
  if p_delete then
    delete from public.market_lots where id = p_id and token = h;
    return json_build_object('deleted', true);
  end if;
  update public.market_lots set
    price = coalesce(p_price, price),
    qty = coalesce(p_qty, qty),
    expires_at = case when p_renew then now() + interval '14 days' else expires_at end
  where id = p_id and token = h
  returning expires_at into v_exp;
  return json_build_object('expires_at', v_exp);
end;
$$;

create or replace function public.market_report(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare who text := public.rqc_voter();
begin
  if (select count(*) from public.market_reports where reporter = who and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'market: too many reports';
  end if;
  insert into public.market_reports (lot_id, reporter) values (p_id, who) on conflict do nothing;
  if (select count(*) from public.market_reports where lot_id = p_id) >= 3 then
    update public.market_lots set hidden = true where id = p_id;
  end if;
end;
$$;

grant execute on function public.market_board(text) to anon, authenticated;
grant execute on function public.market_mine(bigint[], text[]) to anon, authenticated;
grant execute on function public.market_add(text, text, text, int, int, int, int[], boolean, int, bigint, text, text, text) to anon, authenticated;
grant execute on function public.market_edit(bigint, text, bigint, int, boolean, boolean) to anon, authenticated;
grant execute on function public.market_report(bigint) to anon, authenticated;

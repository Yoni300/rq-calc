-- Update 10: a short note on a market listing (up to 120 characters, one line), e.g. «торг уместен», «обмен на карту».
-- The author can change it later in «Мои». Run once in Supabase → SQL Editor after 009-player-market.sql (safe to run again).

alter table public.market_lots add column if not exists note text check (char_length(note) <= 120);

-- the functions return / take the note now: the old versions go first (a new return type can't replace in place)
drop function if exists public.market_board(text);
drop function if exists public.market_mine(bigint[], text[]);
drop function if exists public.market_add(text, text, text, int, int, int, int[], boolean, int, bigint, text, text, text);
drop function if exists public.market_add(text, text, text, int, int, int, int[], boolean, int, bigint, text, text, text, text);
drop function if exists public.market_edit(bigint, text, bigint, int, boolean, boolean);
drop function if exists public.market_edit(bigint, text, bigint, int, boolean, boolean, text);

-- one line, no control characters, trimmed; '' → no note
create or replace function public.market_clean_note(p text)
returns text language sql immutable as $$
  select nullif(left(trim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]+', ' ', 'g')), 120), '');
$$;

create function public.market_board(p_server text)
returns table (id bigint, created_at timestamptz, expires_at timestamptz, side text, kind text, item_id int, upgrade smallint,
               stamp int, cards int[], personal boolean, qty int, price bigint, nick text, discord text, note text)
language sql stable security definer set search_path = public as $$
  select l.id, l.created_at, l.expires_at, l.side, l.kind, l.item_id, l.upgrade, l.stamp, l.cards, l.personal, l.qty, l.price, l.nick, l.discord, l.note
  from public.market_lots l
  where l.server = p_server and not l.hidden and l.expires_at > now()
  order by l.created_at desc
  limit 5000;
$$;

create function public.market_mine(p_ids bigint[], p_secrets text[])
returns table (id bigint, created_at timestamptz, expires_at timestamptz, server text, side text, kind text, item_id int, upgrade smallint,
               stamp int, cards int[], personal boolean, qty int, price bigint, nick text, discord text, note text, hidden boolean)
language sql stable security definer set search_path = public, extensions as $$
  select l.id, l.created_at, l.expires_at, l.server, l.side, l.kind, l.item_id, l.upgrade, l.stamp, l.cards, l.personal, l.qty, l.price, l.nick, l.discord, l.note, l.hidden
  from unnest(p_ids[1:60], p_secrets[1:60]) as k(id, secret)
  join public.market_lots l on l.id = k.id and l.token = encode(digest(k.secret, 'sha256'), 'hex');
$$;

create function public.market_add(p_server text, p_side text, p_kind text, p_item int, p_upgrade int, p_stamp int,
  p_cards int[], p_personal boolean, p_qty int, p_price bigint, p_nick text, p_discord text, p_secret text, p_note text default null)
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
  insert into public.market_lots (expires_at, server, side, kind, item_id, upgrade, stamp, cards, personal, qty, price, nick, discord, note, owner, token)
  values (v_exp, p_server, p_side, p_kind, p_item, coalesce(p_upgrade, 0), p_stamp, coalesce(p_cards, '{}'), coalesce(p_personal, false),
          coalesce(p_qty, 1), p_price, trim(p_nick), nullif(trim(coalesce(p_discord, '')), ''), public.market_clean_note(p_note),
          who, encode(digest(p_secret, 'sha256'), 'hex'))
  returning market_lots.id into v_id;
  delete from public.market_lots where expires_at < now() - interval '30 days';
  return json_build_object('id', v_id, 'expires_at', v_exp);
end;
$$;

-- p_note: null = keep, '' = remove
create function public.market_edit(p_id bigint, p_secret text, p_price bigint, p_qty int, p_renew boolean, p_delete boolean, p_note text default null)
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
    note = case when p_note is null then note else public.market_clean_note(p_note) end,
    expires_at = case when p_renew then now() + interval '14 days' else expires_at end
  where id = p_id and token = h
  returning expires_at into v_exp;
  return json_build_object('expires_at', v_exp);
end;
$$;

grant execute on function public.market_board(text) to anon, authenticated;
grant execute on function public.market_mine(bigint[], text[]) to anon, authenticated;
grant execute on function public.market_add(text, text, text, int, int, int, int[], boolean, int, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.market_edit(bigint, text, bigint, int, boolean, boolean, text) to anon, authenticated;

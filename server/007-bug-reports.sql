-- Update 7: bug reports from the app and the site ("Повідомити про помилку").
-- Players can only send; nobody can read them through the app. Read them in Supabase → Table Editor → bug_reports.
-- At most 3 reports per 10 minutes from one IP (uses rqc_voter() from 003-fair-likes.sql).
-- Run once in Supabase → SQL Editor (safe to run again).

create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 5 and 3000),
  contact text check (char_length(contact) <= 80),
  place text check (char_length(place) <= 40),          -- which tool / tab was open
  version text check (char_length(version) <= 40),
  lang text check (char_length(lang) <= 5),
  platform text check (char_length(platform) <= 20),    -- app / web
  build jsonb,                                           -- the character, if the player attached it
  sender text not null,                                  -- salted IP hash, only for the rate limit
  done boolean not null default false                    -- tick it when the bug is fixed
);
alter table public.bug_reports enable row level security;
-- no policies: players reach the table only through send_bug_report()
revoke all on public.bug_reports from anon, authenticated;

create or replace function public.send_bug_report(p_message text, p_contact text, p_place text, p_version text, p_lang text, p_platform text, p_build jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare who text := public.rqc_voter();
begin
  if (select count(*) from public.bug_reports where sender = who and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'too many reports, try again later';
  end if;
  if p_build is not null and octet_length(p_build::text) > 60000 then p_build := null; end if;
  insert into public.bug_reports (message, contact, place, version, lang, platform, build, sender)
  values (trim(p_message), nullif(trim(p_contact), ''), p_place, p_version, p_lang, p_platform, p_build, who);
end;
$$;
grant execute on function public.send_bug_report(text, text, text, text, text, text, jsonb) to anon, authenticated;

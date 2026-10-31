-- Update 5: the author can change the tags of an already published build.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Like deleting, it is proved by the secret token that only the author's computer has;
-- the allowed tags and "at most 5" are still checked by builds_tags_check (004-build-tags.sql).

create or replace function public.set_build_tags(p_id uuid, p_token text, p_tags text[])
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.builds set tags = coalesce(p_tags, '{}')
  where id = p_id and owner_hash = encode(digest(p_token, 'sha256'), 'hex');
  return found;
end;
$$;
grant execute on function public.set_build_tags(uuid, text, text[]) to anon, authenticated;

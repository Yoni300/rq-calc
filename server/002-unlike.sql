-- Update 2: let players take back their like. Run once in Supabase SQL Editor.
create or replace function public.unlike_build(p_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.builds set likes = greatest(likes - 1, 0) where id = p_id returning likes;
$$;
grant execute on function public.unlike_build(uuid) to anon, authenticated;

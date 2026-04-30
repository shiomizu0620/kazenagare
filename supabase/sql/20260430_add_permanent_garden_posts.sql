-- Add is_permanent flag to garden_posts to protect specific posts from cleanup.
-- Run this in Supabase SQL Editor after 20260317_cleanup_stale_garden_posts.sql.

begin;

alter table public.garden_posts
  add column if not exists is_permanent boolean not null default false;

-- Re-create cleanup function to skip permanent posts.
create or replace function public.cleanup_stale_garden_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.garden_posts
  where updated_at < now() - interval '3 days'
    and is_permanent = false;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

commit;

-- Delete garden posts that have not been updated for 3 days.
-- Run this in Supabase SQL Editor after 20260309_create_garden_posts.sql.

begin;

create extension if not exists pg_cron;

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
  where updated_at < now() - interval '3 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_stale_garden_posts() from public;
grant execute on function public.cleanup_stale_garden_posts() to postgres;

-- Every hour at minute 12.
do $job$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cleanup-stale-garden-posts-hourly'
  ) then
    perform cron.schedule(
      'cleanup-stale-garden-posts-hourly',
      '12 * * * *',
      $sql$select public.cleanup_stale_garden_posts();$sql$
    );
  end if;
end
$job$;

commit;

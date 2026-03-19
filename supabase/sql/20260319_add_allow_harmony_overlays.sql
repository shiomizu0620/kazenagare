-- Add harmony acceptance toggle to garden_posts and enforce it via harmony RLS.
-- Run this after 20260309_create_garden_posts.sql.
--
-- Timeout-safe execution notes:
-- 1) Run each section separately in Supabase SQL Editor.
-- 2) Do not wrap all sections in one explicit BEGIN/COMMIT transaction.
-- 3) If you still hit a timeout, rerun after active app traffic is lower.

-- Section A: schema changes on garden_posts
alter table public.garden_posts
  add column if not exists allow_harmony_overlays boolean;

alter table public.garden_posts
  alter column allow_harmony_overlays set default true;

-- Section B: backfill existing null rows
update public.garden_posts
set allow_harmony_overlays = true
where allow_harmony_overlays is null;

-- Section C: enforce not-null after backfill
alter table public.garden_posts
  alter column allow_harmony_overlays set not null;

-- Section D: refresh harmony RLS policies (only if table exists)
do $section_d$
begin
  if to_regclass('public.garden_harmony_recordings') is null then
    return;
  end if;

  drop policy if exists "garden_harmony_recordings_insert_authenticated"
    on public.garden_harmony_recordings;

  create policy "garden_harmony_recordings_insert_authenticated"
  on public.garden_harmony_recordings
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and exists (
      select 1
      from public.garden_posts
      where garden_posts.user_id = garden_harmony_recordings.garden_owner_id
        and coalesce(garden_posts.allow_harmony_overlays, true) = true
    )
  );

  drop policy if exists "garden_harmony_recordings_update_authenticated"
    on public.garden_harmony_recordings;

  create policy "garden_harmony_recordings_update_authenticated"
  on public.garden_harmony_recordings
  for update
  to authenticated
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and exists (
      select 1
      from public.garden_posts
      where garden_posts.user_id = garden_harmony_recordings.garden_owner_id
        and coalesce(garden_posts.allow_harmony_overlays, true) = true
    )
  )
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and exists (
      select 1
      from public.garden_posts
      where garden_posts.user_id = garden_harmony_recordings.garden_owner_id
        and coalesce(garden_posts.allow_harmony_overlays, true) = true
    )
  );
end
$section_d$;

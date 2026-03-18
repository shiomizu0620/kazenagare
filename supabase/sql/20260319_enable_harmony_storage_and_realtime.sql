-- Enable Supabase Storage and Realtime settings required by garden harmony sync.
-- Run this after 20260319_create_garden_harmony_recordings.sql.

begin;

-- Ensure the shared audio bucket exists and remains public for published garden voices.
insert into storage.buckets (id, name, public)
values ('garden-voices', 'garden-voices', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

-- Anyone can read objects in the public bucket.
drop policy if exists "garden_voices_select_public" on storage.objects;
create policy "garden_voices_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'garden-voices');

-- Authenticated users can upload only under their own top-level folder:
--   <auth.uid()>/... (used by both publish flow and harmony overlay flow).
drop policy if exists "garden_voices_insert_own_prefix" on storage.objects;
create policy "garden_voices_insert_own_prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'garden-voices'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "garden_voices_update_own_prefix" on storage.objects;
create policy "garden_voices_update_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'garden-voices'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'garden-voices'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "garden_voices_delete_own_prefix" on storage.objects;
create policy "garden_voices_delete_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'garden-voices'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Enable postgres_changes subscriptions for harmony metadata updates.
do $$
begin
  if to_regclass('public.garden_harmony_recordings') is not null
     and exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'garden_harmony_recordings'
    ) then
      alter publication supabase_realtime add table public.garden_harmony_recordings;
    end if;
  end if;
end
$$;

commit;

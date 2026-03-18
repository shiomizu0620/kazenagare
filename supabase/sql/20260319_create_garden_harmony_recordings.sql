-- garden_harmony_recordings table + RLS policies
-- Cross-device sync for harmony overlays recorded in visitor gardens.
-- Run this in Supabase SQL Editor after 20260309_create_garden_posts.sql.

begin;

create table if not exists public.garden_harmony_recordings (
  garden_owner_id uuid not null references auth.users(id) on delete cascade,
  object_id text not null,
  object_type text not null,
  recording_id text not null,
  recording_path text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (garden_owner_id, object_id)
);

create index if not exists garden_harmony_recordings_owner_idx
  on public.garden_harmony_recordings (garden_owner_id);

create index if not exists garden_harmony_recordings_updated_at_idx
  on public.garden_harmony_recordings (updated_at desc);

create or replace function public.set_garden_harmony_recordings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_garden_harmony_recordings_set_updated_at on public.garden_harmony_recordings;
create trigger trg_garden_harmony_recordings_set_updated_at
before update on public.garden_harmony_recordings
for each row
execute function public.set_garden_harmony_recordings_updated_at();

alter table public.garden_harmony_recordings enable row level security;

grant select on public.garden_harmony_recordings to anon, authenticated;
grant insert, update on public.garden_harmony_recordings to authenticated;

drop policy if exists "garden_harmony_recordings_select_public" on public.garden_harmony_recordings;
create policy "garden_harmony_recordings_select_public"
on public.garden_harmony_recordings
for select
to anon, authenticated
using (true);

drop policy if exists "garden_harmony_recordings_insert_authenticated" on public.garden_harmony_recordings;
create policy "garden_harmony_recordings_insert_authenticated"
on public.garden_harmony_recordings
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

drop policy if exists "garden_harmony_recordings_update_authenticated" on public.garden_harmony_recordings;
create policy "garden_harmony_recordings_update_authenticated"
on public.garden_harmony_recordings
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

commit;

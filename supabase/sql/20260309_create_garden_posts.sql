-- garden_posts table + RLS policies
-- Run this in Supabase SQL Editor.

begin;

create table if not exists public.garden_posts (
	user_id uuid primary key references auth.users(id) on delete cascade,
	background_id text not null,
	season_id text not null,
	time_slot_id text not null,
	allow_harmony_overlays boolean not null default true,
	placed_objects jsonb not null default '[]'::jsonb,
	published_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Existing table upgrade path (when table already existed without new columns).
alter table public.garden_posts add column if not exists user_id uuid;
alter table public.garden_posts add column if not exists background_id text;
alter table public.garden_posts add column if not exists season_id text;
alter table public.garden_posts add column if not exists time_slot_id text;
alter table public.garden_posts add column if not exists allow_harmony_overlays boolean;
alter table public.garden_posts add column if not exists placed_objects jsonb;
alter table public.garden_posts add column if not exists published_at timestamptz;
alter table public.garden_posts add column if not exists created_at timestamptz;
alter table public.garden_posts add column if not exists updated_at timestamptz;

-- If legacy columns exist, copy values forward.
do $$
begin
	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'garden_posts'
			and column_name = 'selected_background_id'
	) then
		execute 'update public.garden_posts set background_id = selected_background_id where background_id is null and selected_background_id is not null';
	end if;

	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'garden_posts'
			and column_name = 'selected_season_id'
	) then
		execute 'update public.garden_posts set season_id = selected_season_id where season_id is null and selected_season_id is not null';
	end if;

	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'garden_posts'
			and column_name = 'selected_time_slot_id'
	) then
		execute 'update public.garden_posts set time_slot_id = selected_time_slot_id where time_slot_id is null and selected_time_slot_id is not null';
	end if;

	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'garden_posts'
			and column_name = 'id'
	) then
		execute 'update public.garden_posts set user_id = id where user_id is null';
	end if;
end
$$;

update public.garden_posts set background_id = 'bamboo-forest' where background_id is null;
update public.garden_posts set season_id = 'spring' where season_id is null;
update public.garden_posts set time_slot_id = 'daytime' where time_slot_id is null;
update public.garden_posts set allow_harmony_overlays = true where allow_harmony_overlays is null;
update public.garden_posts set placed_objects = '[]'::jsonb where placed_objects is null;

update public.garden_posts set published_at = now() where published_at is null;
update public.garden_posts set created_at = now() where created_at is null;
update public.garden_posts set updated_at = now() where updated_at is null;

-- Attach FK only if it does not exist yet.
do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'garden_posts_user_id_fkey'
	) then
		alter table public.garden_posts
			add constraint garden_posts_user_id_fkey
			foreign key (user_id) references auth.users(id) on delete cascade;
	end if;
end
$$;

-- Ensure upsert(onConflict: user_id) works.
create unique index if not exists garden_posts_user_id_uidx
	on public.garden_posts (user_id);

do $$
begin
	if exists (select 1 from public.garden_posts where user_id is null) then
		raise exception 'garden_posts.user_id に null が残っています。user_id を埋めてから再実行してください。';
	end if;
end
$$;

alter table public.garden_posts alter column published_at set default now();
alter table public.garden_posts alter column created_at set default now();
alter table public.garden_posts alter column updated_at set default now();
alter table public.garden_posts alter column allow_harmony_overlays set default true;
alter table public.garden_posts alter column placed_objects set default '[]'::jsonb;

alter table public.garden_posts alter column user_id set not null;
alter table public.garden_posts alter column published_at set not null;
alter table public.garden_posts alter column created_at set not null;
alter table public.garden_posts alter column updated_at set not null;
alter table public.garden_posts alter column background_id set not null;
alter table public.garden_posts alter column season_id set not null;
alter table public.garden_posts alter column time_slot_id set not null;
alter table public.garden_posts alter column allow_harmony_overlays set not null;
alter table public.garden_posts alter column placed_objects set not null;

create index if not exists garden_posts_published_at_idx
	on public.garden_posts (published_at desc);

create or replace function public.set_garden_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists trg_garden_posts_set_updated_at on public.garden_posts;
create trigger trg_garden_posts_set_updated_at
before update on public.garden_posts
for each row
execute function public.set_garden_posts_updated_at();

alter table public.garden_posts enable row level security;

-- Optional explicit grants for PostgREST roles.
grant select on public.garden_posts to anon, authenticated;
grant insert, update, delete on public.garden_posts to authenticated;

-- Public can view only published posts.
drop policy if exists "garden_posts_select_published" on public.garden_posts;
create policy "garden_posts_select_published"
on public.garden_posts
for select
to anon, authenticated
using (published_at is not null);

-- Authenticated, non-anonymous users can create only their own row.
drop policy if exists "garden_posts_insert_own_non_anonymous" on public.garden_posts;
create policy "garden_posts_insert_own_non_anonymous"
on public.garden_posts
for insert
to authenticated
with check (
	auth.uid() = user_id
	and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- Authenticated, non-anonymous users can update only their own row.
drop policy if exists "garden_posts_update_own_non_anonymous" on public.garden_posts;
create policy "garden_posts_update_own_non_anonymous"
on public.garden_posts
for update
to authenticated
using (
	auth.uid() = user_id
	and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
	auth.uid() = user_id
	and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- Authenticated users can delete only their own row.
drop policy if exists "garden_posts_delete_own" on public.garden_posts;
create policy "garden_posts_delete_own"
on public.garden_posts
for delete
to authenticated
using (auth.uid() = user_id);

commit;

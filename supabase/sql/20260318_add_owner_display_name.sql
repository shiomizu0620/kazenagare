-- Add owner_display_name column to garden_posts table
-- Run this in Supabase SQL Editor after 20260309_create_garden_posts.sql.

begin;

alter table public.garden_posts add column if not exists owner_display_name text;

commit;

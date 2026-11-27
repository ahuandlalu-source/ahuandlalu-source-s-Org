-- ============================================================================
-- PHASE 4: GOOGLE DRIVE INTEGRATION & MEDIA MANAGEMENT — SUPABASE MIGRATION
-- ============================================================================
-- Run this migration in your Supabase SQL Editor.
-- Safely idempotent: preserves all Phase 1, Phase 2 & Phase 3 tables and data.

create extension if not exists "pgcrypto";

-- 1. Google Drive Connection & Folder Configuration (Strictly server-only tokens)
create table if not exists public.drive_integration_state (
  id text primary key default 'primary',
  connected boolean not null default false,
  account_email text,
  account_name text,
  auth_method text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,

  photos_folder_id text,
  photos_folder_name text,
  videos_folder_id text,
  videos_folder_name text,
  music_folder_id text,
  music_folder_name text,
  hero_video_folder_id text,
  hero_video_folder_name text,

  last_sync_at timestamptz,
  last_sync_status text not null default 'idle'
    check (last_sync_status in ('idle', 'syncing', 'success', 'partial_error', 'failed')),
  last_sync_summary jsonb,
  updated_at timestamptz not null default now()
);

insert into public.drive_integration_state (id)
values ('primary')
on conflict (id) do nothing;

-- 2. Discovered & Published Google Drive Media Items
-- CRITICAL: New files are ALWAYS inserted with is_approved = false and is_published = false
create table if not exists public.drive_media_items (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_folder_id text not null,
  folder_role text not null
    check (folder_role in ('photos', 'videos', 'music', 'hero_video')),
  file_name text not null,
  mime_type text not null,
  media_type text not null
    check (media_type in ('photo', 'video', 'audio', 'unsupported')),
  size_bytes bigint not null default 0,
  drive_modified_time text,
  drive_thumbnail_link text,
  drive_web_view_link text,
  discovered_at timestamptz not null default now(),
  drive_availability text not null default 'available'
    check (drive_availability in ('available', 'deleted_in_drive', 'unavailable_permission', 'unsupported')),

  assigned_section text not null default 'unassigned'
    check (assigned_section in ('unassigned', 'photo_gallery', 'video_gallery', 'hero_video', 'background_music')),
  display_order integer not null default 0,
  caption_en text not null default '',
  caption_ml text not null default '',

  processing_status text not null default 'discovered'
    check (processing_status in ('discovered', 'queued', 'downloading', 'uploading', 'ready', 'failed')),
  processing_progress integer not null default 0,
  processing_error text,
  storage_provider text check (storage_provider in ('r2', 'supabase', 'local')),
  storage_key text,
  published_url text,

  is_approved boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_drive_media_published
  on public.drive_media_items (is_approved, is_published, assigned_section, display_order);
create index if not exists idx_drive_media_folder_role
  on public.drive_media_items (folder_role, discovered_at desc);

-- 3. Google Drive Sync Audit Logs
create table if not exists public.drive_sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('success', 'partial_error', 'failed')),
  new_count integer not null default 0,
  updated_count integer not null default 0,
  unavailable_count integer not null default 0,
  failed_count integer not null default 0,
  details jsonb not null default '[]'::jsonb
);

create index if not exists idx_drive_sync_logs_started
  on public.drive_sync_logs (started_at desc);

-- 4. Row Level Security (Tokens strictly admin/service-role only)
alter table public.drive_integration_state enable row level security;
alter table public.drive_media_items enable row level security;
alter table public.drive_sync_logs enable row level security;

drop policy if exists "Admins manage drive state" on public.drive_integration_state;
create policy "Admins manage drive state"
  on public.drive_integration_state for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Public reads only approved published drive media" on public.drive_media_items;
create policy "Public reads only approved published drive media"
  on public.drive_media_items for select
  using (is_approved = true and is_published = true and published_url is not null);

drop policy if exists "Admins manage all drive media" on public.drive_media_items;
create policy "Admins manage all drive media"
  on public.drive_media_items for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admins manage drive sync logs" on public.drive_sync_logs;
create policy "Admins manage drive sync logs"
  on public.drive_sync_logs for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

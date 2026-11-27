-- ============================================================================
-- PHASE 2: KERALA HINDU WEDDING INVITATION CMS — SUPABASE POSTGRES SCHEMA
-- ============================================================================
-- Run this migration in your Supabase SQL Editor or via `supabase db push`.
-- Designed for single-owner CMS management in Phase 2, with clean relational
-- hooks prepared for Phase 3 (RSVP, Wishes, Email Notifications, Google Drive).

create extension if not exists "pgcrypto";

-- 1. Authorized Admin Allowlist (Single-owner initially)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  display_name text,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

-- 2. Root Wedding Site Record (Draft + Published Snapshot separation)
create table if not exists public.wedding_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default 'primary',
  publication_status text not null default 'published' check (publication_status in ('published', 'unpublished')),
  is_placeholder_data boolean not null default true,
  setup_completed boolean not null default false,
  setup_current_step integer not null default 1,

  -- Invitation Cover (Nicknames only)
  bride_nickname_en text not null,
  bride_nickname_ml text not null,
  groom_nickname_en text not null,
  groom_nickname_ml text not null,
  invitation_blessing_en text not null,
  invitation_blessing_ml text not null,
  invitation_phrase_en text not null,
  invitation_phrase_ml text not null,
  invitation_button_en text not null,
  invitation_button_ml text not null,

  -- Hero & Wedding Details
  hero_message_en text not null,
  hero_message_ml text not null,
  hero_video_url text,
  hero_fallback_image_url text not null,
  muhurtham_iso text not null,
  calendar_end_iso text not null,
  display_date_en text not null,
  display_date_ml text not null,
  muhurtham_window_en text not null,
  muhurtham_window_ml text not null,
  malayalam_calendar_date_en text,
  malayalam_calendar_date_ml text,
  additional_info_en text,
  additional_info_ml text,

  -- Venue
  venue_name_en text not null,
  venue_name_ml text not null,
  venue_address1_en text not null,
  venue_address1_ml text not null,
  venue_address2_en text not null,
  venue_address2_ml text not null,
  google_maps_url text not null,
  directions_hint_en text,
  directions_hint_ml text,

  -- Music & Language
  music_enabled boolean not null default true,
  music_url text,
  music_title_en text not null,
  music_title_ml text not null,
  default_language text not null default 'en' check (default_language in ('en', 'ml')),
  malayalam_enabled boolean not null default true,

  -- Social Sharing & Footer
  social_title text not null,
  social_description text not null,
  social_image_url text not null,
  footer_blessing_en text not null,
  footer_blessing_ml text not null,
  footer_hosts_en text not null,
  footer_hosts_ml text not null,
  footer_credit_name text,
  footer_credit_url text,
  footer_show_credit boolean not null default false,

  -- Immutable Public Snapshot (Draft changes never leak before Publish)
  published_snapshot jsonb,
  has_unpublished_changes boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 3. Couple Profiles (Strictly separated Bride & Groom)
create table if not exists public.couple_profiles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  role text not null check (role in ('bride', 'groom')),
  full_name_en text not null,
  full_name_ml text not null,
  portrait_url text not null,
  portrait_alt_en text not null,
  portrait_alt_ml text not null,
  father_name_en text not null,
  father_name_ml text not null,
  mother_name_en text not null,
  mother_name_ml text not null,
  paternal_grandparents_en text not null,
  paternal_grandparents_ml text not null,
  maternal_grandparents_en text not null,
  maternal_grandparents_ml text not null,
  hometown_en text not null,
  hometown_ml text not null,
  personal_intro_en text not null,
  personal_intro_ml text not null,
  additional_note_en text,
  additional_note_ml text,
  updated_at timestamptz not null default now(),
  unique (site_id, role)
);

-- 4. Family Members Directory
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  side text not null check (side in ('bride', 'groom')),
  name_en text not null,
  name_ml text not null,
  relationship_en text not null,
  relationship_ml text not null,
  note_en text,
  note_ml text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Wedding Events & Schedule
create table if not exists public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  title_en text not null,
  title_ml text not null,
  date_label_en text not null,
  date_label_ml text not null,
  time_range_en text not null,
  time_range_ml text not null,
  venue_name_en text not null,
  venue_name_ml text not null,
  description_en text,
  description_ml text,
  image_url text,
  is_muhurtham boolean not null default false,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Media Library & Galleries (Photos, Videos, Audio)
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video', 'audio')),
  url text not null,
  poster_url text,
  title_en text not null default '',
  title_ml text not null default '',
  caption_en text not null default '',
  caption_ml text not null default '',
  alt_en text not null default '',
  alt_ml text not null default '',
  duration text,
  aspect text default 'landscape' check (aspect in ('landscape', 'portrait', 'square')),
  featured boolean not null default false,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  status text not null default 'approved' check (status in ('approved', 'pending')),
  source text not null default 'supabase' check (source in ('local', 'supabase', 'drive', 'r2')),
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Website Sections Configuration
create table if not exists public.website_sections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  section_key text not null check (section_key in ('couple', 'family', 'countdown', 'details', 'gallery', 'videos')),
  heading_en text not null,
  heading_ml text not null,
  subtitle_en text,
  subtitle_ml text,
  display_order integer not null default 0,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (site_id, section_key)
);

-- 8. Real Admin Activity Log
create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wedding_sites(id) on delete cascade,
  actor_email text not null,
  action text not null,
  section text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.admin_users enable row level security;
alter table public.wedding_sites enable row level security;
alter table public.couple_profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.wedding_events enable row level security;
alter table public.media_items enable row level security;
alter table public.website_sections enable row level security;
alter table public.admin_activity_log enable row level security;

-- Helper function: checks whether authenticated JWT belongs to an authorized owner
create or replace function public.is_wedding_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = auth.uid()
       or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Public can only read published_snapshot via server or published wedding_sites row
drop policy if exists "Public read published wedding site" on public.wedding_sites;
create policy "Public read published wedding site"
  on public.wedding_sites for select
  using (publication_status = 'published');

-- Admin full access policies
drop policy if exists "Admin full access wedding_sites" on public.wedding_sites;
create policy "Admin full access wedding_sites"
  on public.wedding_sites for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access couple_profiles" on public.couple_profiles;
create policy "Admin full access couple_profiles"
  on public.couple_profiles for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access family_members" on public.family_members;
create policy "Admin full access family_members"
  on public.family_members for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access wedding_events" on public.wedding_events;
create policy "Admin full access wedding_events"
  on public.wedding_events for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access media_items" on public.media_items;
create policy "Admin full access media_items"
  on public.media_items for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access website_sections" on public.website_sections;
create policy "Admin full access website_sections"
  on public.website_sections for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin full access admin_activity_log" on public.admin_activity_log;
create policy "Admin full access admin_activity_log"
  on public.admin_activity_log for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admin read own admin_users" on public.admin_users;
create policy "Admin read own admin_users"
  on public.admin_users for select
  using (public.is_wedding_admin());

-- Storage Bucket for Wedding Media (create bucket and safe policies)
insert into storage.buckets (id, name, public)
values ('wedding-media', 'wedding-media', true)
on conflict (id) do nothing;

do $$
begin
  drop policy if exists "Public read wedding-media" on storage.objects;
  create policy "Public read wedding-media"
    on storage.objects for select
    using (bucket_id = 'wedding-media');

  drop policy if exists "Admin write wedding-media" on storage.objects;
  create policy "Admin write wedding-media"
    on storage.objects for insert
    with check (bucket_id = 'wedding-media' and public.is_wedding_admin());

  drop policy if exists "Admin delete wedding-media" on storage.objects;
  create policy "Admin delete wedding-media"
    on storage.objects for delete
    using (bucket_id = 'wedding-media' and public.is_wedding_admin());
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.objects policies due to role privileges; create the public bucket "wedding-media" in Storage UI if needed.';
end $$;

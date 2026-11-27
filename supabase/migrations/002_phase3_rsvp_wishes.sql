-- ============================================================================
-- PHASE 3: RSVP, WEDDING WISHES & EMAIL NOTIFICATIONS — SUPABASE MIGRATION
-- ============================================================================
-- Run this migration in your Supabase SQL Editor.
-- Safely idempotent: preserves all Phase 1 & Phase 2 tables and rows.

create extension if not exists "pgcrypto";

-- 1. Phase 3 Settings (RSVP & Wishes configuration + separate notification settings)
create table if not exists public.phase3_settings (
  id text primary key default 'primary',

  -- RSVP Section & Form Config
  rsvp_enabled boolean not null default true,
  rsvp_heading_en text not null default 'Will You Be Joining Us?',
  rsvp_heading_ml text not null default 'ഞങ്ങളോടൊപ്പം പങ്കുചേരുമോ?',
  rsvp_subtitle_en text not null default 'Kindly let us know if you will grace our wedding celebration with your presence.',
  rsvp_subtitle_ml text not null default 'വിവാഹ ചടങ്ങിൽ പങ്കെടുക്കുമോ എന്ന് ദയവായി ഞങ്ങളെ അറിയിക്കുക.',
  rsvp_allow_attendee_count boolean not null default true,
  rsvp_max_attendees integer not null default 10 check (rsvp_max_attendees >= 1 and rsvp_max_attendees <= 30),
  rsvp_custom_fields jsonb not null default '[]'::jsonb,

  -- RSVP Email Notification Settings
  rsvp_notify_enabled boolean not null default false,
  rsvp_notify_email text not null default '',

  -- Wedding Wishes Section & Moderation Config (manual approval by default)
  wishes_enabled boolean not null default true,
  wishes_heading_en text not null default 'Send Your Wishes',
  wishes_heading_ml text not null default 'ആശംസകൾ നേരുക',
  wishes_subtitle_en text not null default 'Share your blessings, fond memories, and messages of love for the couple.',
  wishes_subtitle_ml text not null default 'വധൂവരന്മാർക്കായി നിങ്ങളുടെ അനുഗ്രഹങ്ങളും സ്നേഹാശംസകളും പങ്കുവയ്ക്കുക.',
  wishes_auto_approve boolean not null default false,

  -- Wishes Email Notification Settings
  wishes_notify_enabled boolean not null default false,
  wishes_notify_email text not null default '',

  updated_at timestamptz not null default now()
);

-- Seed default settings row if missing
insert into public.phase3_settings (id)
values ('primary')
on conflict (id) do nothing;

-- 2. Guest RSVPs (Strictly private — never exposed publicly)
create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  attendance text not null check (attendance in ('attending', 'not_attending')),
  attendee_count integer not null default 1 check (attendee_count >= 0 and attendee_count <= 30),
  message text not null default '',
  custom_fields jsonb not null default '{}'::jsonb,
  admin_note text not null default '',
  client_submission_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rsvps_created_at on public.rsvps (created_at desc);
create index if not exists idx_rsvps_attendance on public.rsvps (attendance);

-- 3. Wedding Wishes / Guestbook (Private until approved & published)
create table if not exists public.wedding_wishes (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  message text not null,
  emoji text not null default '',
  photo_storage_path text,
  photo_mime_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_published boolean not null default false,
  client_submission_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wishes_status_published on public.wedding_wishes (status, is_published, created_at desc);

-- 4. Email Delivery Audit & Idempotent Retry Log
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('rsvp', 'wishes')),
  record_id uuid not null,
  recipient_email text not null,
  subject text not null,
  idempotency_key text not null unique,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_email_deliveries_category_created on public.email_deliveries (category, created_at desc);

-- 5. Enable Row Level Security (Server routes use Service Role; browser anon access restricted)
alter table public.phase3_settings enable row level security;
alter table public.rsvps enable row level security;
alter table public.wedding_wishes enable row level security;
alter table public.email_deliveries enable row level security;

drop policy if exists "Public can read safe phase3 settings" on public.phase3_settings;
create policy "Public can read safe phase3 settings"
  on public.phase3_settings for select
  using (true);

drop policy if exists "Admins manage phase3 settings" on public.phase3_settings;
create policy "Admins manage phase3 settings"
  on public.phase3_settings for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admins manage rsvps" on public.rsvps;
create policy "Admins manage rsvps"
  on public.rsvps for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Public can read approved published wishes" on public.wedding_wishes;
create policy "Public can read approved published wishes"
  on public.wedding_wishes for select
  using (status = 'approved' and is_published = true);

drop policy if exists "Admins manage all wishes" on public.wedding_wishes;
create policy "Admins manage all wishes"
  on public.wedding_wishes for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

drop policy if exists "Admins manage email deliveries" on public.email_deliveries;
create policy "Admins manage email deliveries"
  on public.email_deliveries for all
  using (public.is_wedding_admin())
  with check (public.is_wedding_admin());

-- 6. Private Storage Bucket for Wish Photos (public = false so pending photos cannot leak)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('wedding-wishes-private', 'wedding-wishes-private', false)
  on conflict (id) do update set public = false;
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.buckets creation due to permissions — create private bucket "wedding-wishes-private" manually if needed.';
end $$;

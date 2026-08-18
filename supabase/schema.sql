-- ============================================================
--  Crew Reference Site — Supabase schema
--  Run this once in the Supabase SQL editor on a new project.
--
--  Media is NEVER stored here. Google Drive holds every image and
--  video; these tables hold links, labels and decisions only.
-- ============================================================

-- ---------- events ----------
create table events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  starts_on         date,                 -- Cancun: 2026-09-09
  ends_on           date,                 -- Cancun: 2026-09-12 (multi-day events)
  location          text,
  cover_drive_link  text,
  hero_drive_link   text,
  direction_note    text,                 -- the pinned "here is the call" line
  strategy_doc_url  text,
  sort_order        int default 0,
  created_at        timestamptz default now()
);

-- ---------- quick links ----------
create table quick_links (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  label      text not null,
  url        text not null,
  sort_order int default 0
);

-- ---------- run of show ----------
-- Cancun runs two tracks on one clock: what guests are doing, and what
-- the crew is shooting. A "track" covers both that and the HK-style
-- per-crew grouping, so one shape serves both events.
create table event_days (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  label      text not null,               -- 'Day One', '(Setup) Sept 7'
  date       date,
  is_setup   boolean default false,
  sort_order int default 0
);

create table tracks (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,               -- 'Guest Agenda', 'Crew — Video', 'Photographer'
  kind       text not null default 'crew' check (kind in ('guest','crew')),
  director   text,
  host       text,
  objective  text,
  sort_order int default 0
);

create table shot_list_items (
  id             uuid primary key default gen_random_uuid(),
  event_day_id   uuid not null references event_days(id) on delete cascade,
  track_id       uuid not null references tracks(id) on delete cascade,
  time_range     text,                    -- kept as text: '08:00AM - 09:00AM'
  starts_at      time,                    -- parsed, drives the live "now" marker
  ends_at        time,
  activity       text not null,
  detail         text,
  note           text,
  location       text,
  sort_order     int default 0
);

-- ---------- moodboard: source > year > format > item ----------
create table inspo_sources (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  name           text not null,           -- 'Nude Project'
  is_main        boolean default false,
  direction_note text,
  drive_folder_id text,                   -- root folder; import walks down from here
  last_synced_at timestamptz,
  sort_order     int default 0
);

create table inspo_years (
  id              uuid primary key default gen_random_uuid(),
  inspo_source_id uuid not null references inspo_sources(id) on delete cascade,
  label           text not null,          -- '2k24'
  drive_folder_id text,
  sort_order      int default 0
);

-- One row per post. A Drive FILE inside a year folder is a reel;
-- a Drive SUBFOLDER is a carousel and its files are the slides.
create table inspo_posts (
  id              uuid primary key default gen_random_uuid(),
  inspo_year_id   uuid not null references inspo_years(id) on delete cascade,
  format          text not null check (format in ('reel','carousel')),
  label           text not null,          -- the date from the filename: '14 Mar 24'
  posted_on       date,                   -- parsed from the label where possible
  drive_id        text not null,          -- file id (reel) or folder id (carousel)
  slide_count     int default 0,          -- carousels only
  status          text not null default 'option' check (status in ('option','selected')),
  note            text,
  sort_order      int default 0
);

create table inspo_slides (
  id             uuid primary key default gen_random_uuid(),
  inspo_post_id  uuid not null references inspo_posts(id) on delete cascade,
  drive_file_id  text not null,
  sort_order     int default 0
);

-- ---------- other reference grids (environment, b-roll, flow) ----------
create table media_sections (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  section_type   text not null check (section_type in ('environment','b_roll','hero_flow_reference')),
  group_label    text,                    -- 'Palapa Entrance', 'Cenote'
  schedule_label text,                    -- b-roll: 'Golden Hour — 17:30–18:30'
  direction_note text,
  drive_folder_id text,
  last_synced_at timestamptz,
  is_sequence    boolean default false,   -- true = show the -> connectors
  sort_order     int default 0
);

create table media_items (
  id               uuid primary key default gen_random_uuid(),
  media_section_id uuid not null references media_sections(id) on delete cascade,
  drive_file_id    text not null,
  caption          text,
  timestamp_label  text,
  aspect           text default 'landscape' check (aspect in ('landscape','portrait','square')),
  status           text not null default 'option' check (status in ('option','selected')),
  sort_order       int default 0
);

-- Rows point at reference grids by name-independent id.
create table shot_list_item_refs (
  shot_list_item_id uuid not null references shot_list_items(id) on delete cascade,
  media_section_id  uuid not null references media_sections(id) on delete cascade,
  primary key (shot_list_item_id, media_section_id)
);

-- ---------- content pieces (deliverables and their breakdowns) ----------
-- A deliverable IS a content piece; the checklist is a view over this,
-- so there is no second list to keep in sync.
create table content_pieces (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  title          text not null,
  kind           text not null check (kind in ('reel','carousel','photo_set')),
  aspect         text default '16:9',
  drive_link     text,
  owner          text,
  status         text default 'not_started' check (status in ('not_started','in_edit','delivered')),
  duration_label text,
  expected_count int default 1,
  delivered_count int default 0,
  final_link     text,
  sort_order     int default 0
);

-- Marked up by hand against the cut: an embedded Drive player never
-- exposes its frames, so these are entered, not detected.
create table shots (
  id                uuid primary key default gen_random_uuid(),
  content_piece_id  uuid not null references content_pieces(id) on delete cascade,
  idx               int not null,
  timecode          text,                 -- '0:14'
  caption           text,
  note              text,
  frame_drive_id    text,                 -- optional still, if someone grabs one
  status            text not null default 'option' check (status in ('option','selected')),
  sort_order        int default 0
);

-- Six hex strings per palette. Sampled once at import from the Drive
-- thumbnail, then stored as text. No image is ever kept.
create table palette_swatches (
  id               uuid primary key default gen_random_uuid(),
  inspo_source_id  uuid references inspo_sources(id) on delete cascade,
  inspo_year_id    uuid references inspo_years(id) on delete cascade,
  content_piece_id uuid references content_pieces(id) on delete cascade,
  hex              text not null,
  role_label       text,
  source           text default 'auto' check (source in ('auto','manual')),
  sort_order       int default 0,
  constraint palette_owner_present check (
    num_nonnulls(inspo_source_id, inspo_year_id, content_piece_id) = 1
  )
);

-- ---------- vo script ----------
create table vo_lines (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  speaker_name text,
  speaker_role text,
  line_text    text not null,
  sort_order   int default 0
);

-- ============================================================
--  Row Level Security
--  Crew view reads directly with the anon key. Every write goes
--  through the admin route using the service role key, which
--  bypasses RLS — so there is no public write policy at all.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'events','quick_links','event_days','tracks','shot_list_items',
    'inspo_sources','inspo_years','inspo_posts','inspo_slides',
    'media_sections','media_items','shot_list_item_refs',
    'content_pieces','shots','palette_swatches','vo_lines'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', t || '_public_read', t);
  end loop;
end $$;

create index on shot_list_items (event_day_id, track_id);
create index on inspo_posts (inspo_year_id);
create index on media_items (media_section_id);
create index on shots (content_piece_id);

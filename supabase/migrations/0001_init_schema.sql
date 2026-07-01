-- ============================================================================
-- CampusFind — Initial Schema Migration
-- Target: Supabase (Postgres)
-- Source of truth: PRD.md, ARCHITECTURE.md, CONTEXT.md, CampusFind_SRS.docx
-- ============================================================================
-- Design notes (do not remove — these encode decisions from the SRS):
--
-- 1. Report.status is the SINGLE SOURCE OF TRUTH for report state. Never infer
--    status from claims/messages existence. Enforced here via trigger-guarded
--    transitions, not via derived views.
--
-- 2. Two report lifecycles share one table (CONTEXT.md "Known Issues"):
--      lost:         open -> claimed -> approved -> resolved
--                      claimed -> open (on claim rejection)
--      found_walkin: open -> resolved (admin-driven, no claimed/approved)
--    A CHECK constraint blocks found_walkin rows from ever holding
--    'claimed' or 'approved' status.
--
-- 3. Hard caps (CONTEXT.md "Conventions") are enforced at the DB layer via
--    triggers, not just application code, since they are stated as hard
--    limits with server-side enforcement required:
--      - 3 photos per report, 3 photos per claim
--      - 10 messages per claim thread
--      - 25 tips per report
--      - 1 active (pending/approved) claim per report
--
-- 4. CSV bulk import is all-or-nothing (FR-1) — handled at the application/
--    Express layer (validate-then-commit), not in the DB schema itself.
--    bulk_import_batches/rows tables exist here only to give the admin a
--    durable preview/audit trail, not to do partial writes.
--
-- 5. Deactivated/graduated users preserve trust_score_events history and are
--    reinstated on reactivation (SRS Section 9) — handled by never deleting
--    User or TrustScoreEvent rows, only flipping status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('student', 'admin');
create type user_status as enum ('active', 'deactivated');

create type report_type as enum ('lost', 'found_walkin');
create type report_status as enum ('open', 'claimed', 'approved', 'resolved', 'rejected');
create type resolved_via_type as enum ('handoff', 'issc_dropoff', 'issc_walkin_pickup');

create type claim_status as enum ('pending', 'approved', 'rejected');

create type message_sender_role as enum ('reporter', 'claimant');

create type trust_event_reason as enum (
  'claim_rejected',
  'repeat_rejections_30d',
  'no_show_handoff',
  'claim_approved_handoff_completed',
  'issc_dropoff_returned',
  'tip_credited'
);

create type bulk_import_row_action as enum ('create', 'deactivate', 'skip_duplicate', 'error');
create type bulk_import_batch_status as enum ('pending_review', 'confirmed', 'discarded');

-- ----------------------------------------------------------------------------
-- users
-- FR-1: admin-only creation, Student ID YY-NNNNN, Enrollment Number 6-10 digits
-- ----------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique
    constraint chk_student_id_format check (student_id ~ '^[0-9]{2}-[0-9]{5}$'),
  enrollment_number text not null unique
    constraint chk_enrollment_number_format check (enrollment_number ~ '^[0-9]{6,10}$'),
  last_name text not null,
  first_name text not null,
  middle_name text,
  program text,           -- "Program/Course" in CSV (FR-1)
  year_level text,
  role user_role not null default 'student',
  status user_status not null default 'active',
  trust_score integer not null default 100,
  force_password_change boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_status on users (status);
create index idx_users_role on users (role);

comment on column users.trust_score is
  'Starts at 100. Adjusted only via trust_score_events; informational, no auto-enforcement (SRS Section 5).';
comment on column users.status is
  'deactivated = graduated/inactive. Row + history preserved; reinstated on reactivation, never deleted (SRS Section 9).';

-- ----------------------------------------------------------------------------
-- reports
-- FR-2 (lost), FR-11 (found_walkin / ISSC walk-in)
-- ----------------------------------------------------------------------------
create table reports (
  id uuid primary key default gen_random_uuid(),
  type report_type not null,
  title text not null,
  description text not null,
  location text not null,        -- "last seen" (lost) or ISSC office (found_walkin)
  category text,                 -- used by FR-3 browse/search filters, FR-7 analytics

  status report_status not null default 'open',

  reporter_id uuid not null references users(id),
    -- lost: the person who lost the item
    -- found_walkin: still required; set to the admin's user id acting on
    -- behalf of the walk-in finder, since the finder has no account (FR-11)

  walkin_finder_ref text,        -- admin-logged name/Student ID of the
                                  -- physical walk-in finder (found_walkin only)

  walkin_pickup_verified_by uuid references users(id),  -- admin who verified ID
  walkin_pickup_verified_at timestamptz,

  resolved_via resolved_via_type,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_found_walkin_lifecycle check (
    type <> 'found_walkin' or status in ('open', 'resolved')
  ),
  constraint chk_walkin_ref_required check (
    type <> 'found_walkin' or walkin_finder_ref is not null
  )
);

create index idx_reports_status on reports (status);
create index idx_reports_type on reports (type);
create index idx_reports_reporter on reports (reporter_id);
create index idx_reports_category on reports (category);
create index idx_reports_location on reports (location);
-- keyword search (FR-3)
create index idx_reports_search on reports
  using gin (to_tsvector('english', title || ' ' || description));

comment on column reports.status is
  'Single source of truth for report state. Do not infer from claims/messages (CONTEXT.md Conventions).';

-- ----------------------------------------------------------------------------
-- report_photos  (max 3 per report, optional — FR-2)
-- ----------------------------------------------------------------------------
create table report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  storage_path text not null,    -- Supabase Storage object path
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_report_photos_report on report_photos (report_id);

-- ----------------------------------------------------------------------------
-- claims
-- FR-4: mandatory photo, max 3, one active claim per report, 10-msg thread
-- ----------------------------------------------------------------------------
create table claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  claimant_id uuid not null references users(id),
  status claim_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_claims_report on claims (report_id);
create index idx_claims_claimant on claims (claimant_id);
create index idx_claims_status on claims (status);

-- Partial unique index: only one pending OR approved claim per report at a time.
-- Rejected claims don't count (report reopens, new claims allowed — FR-4).
create unique index uq_one_active_claim_per_report
  on claims (report_id)
  where status in ('pending', 'approved');

-- ----------------------------------------------------------------------------
-- claim_photos (mandatory, max 3 per claim — FR-4)
-- ----------------------------------------------------------------------------
create table claim_photos (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_claim_photos_claim on claim_photos (claim_id);

-- ----------------------------------------------------------------------------
-- claim_messages
-- FR-4: thread capped at 10 messages, opens only on claim approval
-- ----------------------------------------------------------------------------
create table claim_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id),
  sender_id uuid not null references users(id),
  sender_role message_sender_role not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_claim_messages_claim on claim_messages (claim_id, created_at);

-- ----------------------------------------------------------------------------
-- tips
-- FR-9: text-only, max 25 per report, convertible to a claim later
-- ----------------------------------------------------------------------------
create table tips (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  user_id uuid not null references users(id),
  text text not null,
  converted_to_claim_id uuid references claims(id),
  credited_for_recovery boolean not null default false, -- drives +2 trust event
  created_at timestamptz not null default now()
);

create index idx_tips_report on tips (report_id, created_at);
create index idx_tips_user on tips (user_id);

-- ----------------------------------------------------------------------------
-- trust_score_events
-- SRS Section 5 / ARCHITECTURE.md trust score rules
-- ----------------------------------------------------------------------------
create table trust_score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  delta integer not null,
  reason trust_event_reason not null,
  related_claim_id uuid references claims(id),
  related_tip_id uuid references tips(id),
  created_at timestamptz not null default now()
);

create index idx_trust_events_user on trust_score_events (user_id, created_at);

-- ----------------------------------------------------------------------------
-- bulk_import_batches / bulk_import_rows
-- FR-1: CSV preview/confirm workflow, all-or-nothing validation, row-level edits
-- ----------------------------------------------------------------------------
create table bulk_import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references users(id),
  filename text not null,
  status bulk_import_batch_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table bulk_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references bulk_import_batches(id) on delete cascade,
  row_number integer not null,
  student_id text,
  enrollment_number text,
  last_name text,
  first_name text,
  middle_name text,
  program text,
  year_level text,
  csv_status text,              -- raw "Status" column value: New/Continuing/Graduate-Inactive
  action bulk_import_row_action not null,
  error_message text,           -- populated when action = 'error'
  edited boolean not null default false, -- admin edited this row in preview
  created_at timestamptz not null default now()
);

create index idx_bulk_import_rows_batch on bulk_import_rows (batch_id);

-- ============================================================================
-- TRIGGERS — hard caps + invariants enforced server-side (not just client)
-- ============================================================================

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();
create trigger trg_reports_updated_at before update on reports
  for each row execute function set_updated_at();
create trigger trg_claims_updated_at before update on claims
  for each row execute function set_updated_at();

-- Max 3 photos per report
create or replace function enforce_report_photo_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from report_photos where report_id = new.report_id) >= 3 then
    raise exception 'Report % already has the maximum of 3 photos', new.report_id;
  end if;
  return new;
end;
$$;

create trigger trg_report_photo_limit before insert on report_photos
  for each row execute function enforce_report_photo_limit();

-- Max 3 photos per claim
create or replace function enforce_claim_photo_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from claim_photos where claim_id = new.claim_id) >= 3 then
    raise exception 'Claim % already has the maximum of 3 photos', new.claim_id;
  end if;
  return new;
end;
$$;

create trigger trg_claim_photo_limit before insert on claim_photos
  for each row execute function enforce_claim_photo_limit();

-- Max 10 messages per claim thread
create or replace function enforce_message_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from claim_messages where claim_id = new.claim_id) >= 10 then
    raise exception 'Claim % has reached the 10-message cap', new.claim_id;
  end if;
  return new;
end;
$$;

create trigger trg_message_cap before insert on claim_messages
  for each row execute function enforce_message_cap();

-- Max 25 tips per report
create or replace function enforce_tip_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from tips where report_id = new.report_id) >= 25 then
    raise exception 'Report % has reached the 25-tip cap', new.report_id;
  end if;
  return new;
end;
$$;

create trigger trg_tip_cap before insert on tips
  for each row execute function enforce_tip_cap();

-- Keep users.trust_score in sync with trust_score_events (denormalized for
-- fast reads; events table remains the source of truth/history per SRS Sec.9)
create or replace function apply_trust_score_event()
returns trigger language plpgsql as $$
begin
  update users set trust_score = trust_score + new.delta where id = new.user_id;
  return new;
end;
$$;

create trigger trg_apply_trust_score_event after insert on trust_score_events
  for each row execute function apply_trust_score_event();

-- ============================================================================
-- End of migration 0001
-- ============================================================================

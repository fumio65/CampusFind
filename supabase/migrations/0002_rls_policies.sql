-- ============================================================================
-- CampusFind — Row Level Security policies
-- Run AFTER 0001_init_schema.sql.
-- ============================================================================
-- Model: every table has RLS enabled (matches "Enable automatic RLS" project
-- setting). Two roles read from auth.jwt(): 'student' and 'admin', mirrored
-- from public.users.role for the currently authenticated user.
--
-- Helper: is_admin() checks the caller's row in public.users. Since Supabase
-- Auth's user id (auth.uid()) is the natural key to join against, we assume
-- public.users.id = auth.users.id (set this at account-creation time in the
-- bulk-import / single-add Express flow).
-- ============================================================================

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from users
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table users enable row level security;
alter table reports enable row level security;
alter table report_photos enable row level security;
alter table claims enable row level security;
alter table claim_photos enable row level security;
alter table claim_messages enable row level security;
alter table tips enable row level security;
alter table trust_score_events enable row level security;
alter table bulk_import_batches enable row level security;
alter table bulk_import_rows enable row level security;

-- ----------------------------------------------------------------------------
-- users
-- Students read their own row only. Admins read/write everyone (account
-- provisioning, FR-1, is admin-only by design).
-- ----------------------------------------------------------------------------
create policy "users read own row" on users
  for select using (id = auth.uid());

create policy "admin reads all users" on users
  for select using (is_admin());

create policy "admin writes users" on users
  for insert with check (is_admin());

create policy "admin updates users" on users
  for update using (is_admin());

-- ----------------------------------------------------------------------------
-- reports
-- All authenticated users can browse open/claimed/approved/resolved reports
-- (FR-3 browse). Reporters can update only their own reports' non-status
-- fields via the app layer; status transitions are admin- or flow-driven.
-- Admins get full access (FR-5 monitoring, FR-11 walk-ins).
-- ----------------------------------------------------------------------------
create policy "anyone authenticated reads reports" on reports
  for select using (auth.role() = 'authenticated');

create policy "students create their own lost reports" on reports
  for insert with check (
    type = 'lost' and reporter_id = auth.uid()
  );

create policy "admin creates any report" on reports
  for insert with check (is_admin());

create policy "reporter updates own report" on reports
  for update using (reporter_id = auth.uid());

create policy "admin updates any report" on reports
  for update using (is_admin());

-- ----------------------------------------------------------------------------
-- report_photos / claim_photos
-- Readable by anyone authenticated (photos are part of public report data).
-- Writable by the owning reporter/claimant, or admin.
-- ----------------------------------------------------------------------------
create policy "anyone authenticated reads report photos" on report_photos
  for select using (auth.role() = 'authenticated');

create policy "reporter adds own report photos" on report_photos
  for insert with check (
    exists (select 1 from reports where id = report_id and reporter_id = auth.uid())
    or is_admin()
  );

create policy "anyone authenticated reads claim photos" on claim_photos
  for select using (auth.role() = 'authenticated');

create policy "claimant adds own claim photos" on claim_photos
  for insert with check (
    exists (select 1 from claims where id = claim_id and claimant_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- claims
-- Visible to the claimant, the report's reporter, and admin (claim review is
-- reporter-private per FR-4, not public browse data).
-- ----------------------------------------------------------------------------
create policy "claimant reads own claims" on claims
  for select using (claimant_id = auth.uid());

create policy "reporter reads claims on own reports" on claims
  for select using (
    exists (select 1 from reports where id = report_id and reporter_id = auth.uid())
  );

create policy "admin reads all claims" on claims
  for select using (is_admin());

create policy "students submit claims" on claims
  for insert with check (claimant_id = auth.uid());

create policy "reporter reviews own report claims" on claims
  for update using (
    exists (select 1 from reports where id = report_id and reporter_id = auth.uid())
  );

create policy "admin updates claims" on claims
  for update using (is_admin());

-- ----------------------------------------------------------------------------
-- claim_messages
-- Visible only to the two parties on the thread (reporter + claimant) and admin.
-- ----------------------------------------------------------------------------
create policy "thread participants read messages" on claim_messages
  for select using (
    exists (
      select 1 from claims c join reports r on r.id = c.report_id
      where c.id = claim_id and (c.claimant_id = auth.uid() or r.reporter_id = auth.uid())
    ) or is_admin()
  );

create policy "thread participants send messages" on claim_messages
  for insert with check (
    sender_id = auth.uid() and
    exists (
      select 1 from claims c join reports r on r.id = c.report_id
      where c.id = claim_id and (c.claimant_id = auth.uid() or r.reporter_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- tips
-- Readable by anyone authenticated (tips are shown inline on item detail,
-- per the mobile item-detail design). Any authenticated user can write.
-- ----------------------------------------------------------------------------
create policy "anyone authenticated reads tips" on tips
  for select using (auth.role() = 'authenticated');

create policy "any user leaves tips" on tips
  for insert with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- trust_score_events
-- Users read their own history (FR-10 trust score visibility). Only the
-- backend (service role, via Express trigger logic) writes these — no
-- authenticated-role insert policy, so direct client writes are blocked.
-- ----------------------------------------------------------------------------
create policy "users read own trust events" on trust_score_events
  for select using (user_id = auth.uid());

create policy "admin reads all trust events" on trust_score_events
  for select using (is_admin());

-- ----------------------------------------------------------------------------
-- bulk_import_batches / bulk_import_rows
-- Admin-only end to end (FR-1 is explicitly admin-only).
-- ----------------------------------------------------------------------------
create policy "admin manages import batches" on bulk_import_batches
  for all using (is_admin()) with check (is_admin());

create policy "admin manages import rows" on bulk_import_rows
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- End of RLS policies
-- ============================================================================

-- ============================================================================
-- Migration: Comprehensive Row-Level Security (RLS) Policies
-- Version:  2026-04-01
-- Description:
--   Enables RLS on ALL tables and creates granular, idempotent policies.
--   Designed to be safe to run multiple times — all existing policies
--   are dropped before being recreated.
--
-- Key principles:
--   • auth.uid()         → authenticated user's ID (matches users.id)
--   • auth.role()        → 'authenticated' | 'service_role'
--   • Service role always bypasses RLS; these policies govern app users.
--   • Organization scoping uses JOIN via users.organization_id.
-- ============================================================================

-- ============================================================================
-- Helper: drop policy if it exists (idempotent wrapper)
-- ============================================================================
do $$
begin
  -- Drop policies for base-schema tables
  drop policy if exists "rules_select_all"                    on rules;
  drop policy if exists "categories_select_all"               on categories;
  drop policy if exists "tasks_select_all"                    on tasks;

  drop policy if exists "organizations_select_org_members"    on organizations;
  drop policy if exists "organizations_update_admin"          on organizations;

  drop policy if exists "users_select_self_and_org"           on users;
  drop policy if exists "users_update_self"                   on users;

  drop policy if exists "user_task_instances_select_self_and_org"  on user_task_instances;
  drop policy if exists "user_task_instances_update_own"           on user_task_instances;

  drop policy if exists "task_completions_select_own"         on task_completions;
  drop policy if exists "task_completions_insert_own"         on task_completions;

  drop policy if exists "evidence_attachments_select_own"     on evidence_attachments;
  drop policy if exists "evidence_attachments_insert_own"     on evidence_attachments;

  drop policy if exists "activity_logs_select_org"            on activity_logs;
  drop policy if exists "activity_logs_insert_own"            on activity_logs;

  -- Drop policies for V1-app-schema tables
  drop policy if exists "onboarding_profiles_select_own"      on onboarding_profiles;
  drop policy if exists "onboarding_profiles_update_own"      on onboarding_profiles;
  drop policy if exists "onboarding_profiles_insert_own"      on onboarding_profiles;

  drop policy if exists "custom_categories_select_org"        on custom_categories;
  drop policy if exists "custom_categories_insert_own"        on custom_categories;
  drop policy if exists "custom_categories_update_own"        on custom_categories;
  drop policy if exists "custom_categories_delete_own"        on custom_categories;

  drop policy if exists "custom_tasks_select_org"             on custom_tasks;
  drop policy if exists "custom_tasks_insert_own"             on custom_tasks;
  drop policy if exists "custom_tasks_update_own"             on custom_tasks;
  drop policy if exists "custom_tasks_delete_own"             on custom_tasks;

  drop policy if exists "hidden_items_select_org"             on hidden_items;
  drop policy if exists "hidden_items_insert_own"             on hidden_items;
  drop policy if exists "hidden_items_delete_own"             on hidden_items;

  drop policy if exists "admin_settings_no_access"            on admin_settings;

  drop policy if exists "admin_login_rate_limits_no_access"   on admin_login_rate_limits;

  drop policy if exists "task_reminder_deliveries_select_own" on task_reminder_deliveries;

  drop policy if exists "knowledge_articles_select_active"     on knowledge_articles;
end
$$;


-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES (idempotent — safe to re-run)
-- ============================================================================

-- Base schema tables
alter table rules                  enable row level security;
alter table categories             enable row level security;
alter table tasks                  enable row level security;
alter table organizations          enable row level security;
alter table users                  enable row level security;
alter table user_task_instances    enable row level security;
alter table task_completions       enable row level security;
alter table evidence_attachments   enable row level security;
alter table activity_logs          enable row level security;

-- V1 app schema tables
alter table if exists onboarding_profiles        enable row level security;
alter table if exists custom_categories          enable row level security;
alter table if exists custom_tasks               enable row level security;
alter table if exists hidden_items               enable row level security;
alter table if exists admin_settings             enable row level security;
alter table if exists admin_login_rate_limits    enable row level security;
alter table if exists task_reminder_deliveries   enable row level security;
alter table if exists knowledge_articles         enable row level security;


-- ============================================================================
-- 2. POLICIES — REFERENCE DATA (rules, categories, tasks)
--    These are imported, read-only reference tables. All authenticated users
--    need SELECT. No INSERT/UPDATE/DELETE from the app.
-- ============================================================================

create policy "rules_select_all"
  on rules
  for select
  to authenticated
  using (true);

create policy "categories_select_all"
  on categories
  for select
  to authenticated
  using (true);

create policy "tasks_select_all"
  on tasks
  for select
  to authenticated
  using (true);


-- ============================================================================
-- 3. POLICIES — ORGANIZATIONS
--    Members of an org can read it. Only admins / the org creator can UPDATE.
-- ============================================================================

create policy "organizations_select_org_members"
  on organizations
  for select
  to authenticated
  using (
    id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "organizations_update_admin"
  on organizations
  for update
  to authenticated
  using (
    -- Allow if the user is the creator of the org
    created_by = auth.uid()
    or
    -- Allow if the user is an admin in this org
    id in (
      select organization_id
      from users
      where id = auth.uid()
        and role in ('admin', 'manager')
        and organization_id is not null
    )
  )
  with check (
    created_by = auth.uid()
    or
    id in (
      select organization_id
      from users
      where id = auth.uid()
        and role in ('admin', 'manager')
        and organization_id is not null
    )
  );


-- ============================================================================
-- 4. POLICIES — USERS
--    Users can read their own record and records of org-mates.
--    Users can update their own record (name, etc.).
-- ============================================================================

create policy "users_select_self_and_org"
  on users
  for select
  to authenticated
  using (
    id = auth.uid()
    or
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "users_update_self"
  on users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================================
-- 5. POLICIES — USER_TASK_INSTANCES
--    Users see their own instances and any instance in their org (team
--    visibility). Users can update their own instances (mark complete).
-- ============================================================================

create policy "user_task_instances_select_self_and_org"
  on user_task_instances
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "user_task_instances_update_own"
  on user_task_instances
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- 6. POLICIES — TASK_COMPLETIONS
--    Users can read and insert their own completion records. No updates or
--    deletes to preserve audit integrity.
-- ============================================================================

create policy "task_completions_select_own"
  on task_completions
  for select
  to authenticated
  using (
    completed_by = auth.uid()
    or
    user_task_instance_id in (
      select id
      from user_task_instances
      where user_id = auth.uid()
    )
  );

create policy "task_completions_insert_own"
  on task_completions
  for insert
  to authenticated
  with check (
    completed_by = auth.uid()
    and
    user_task_instance_id in (
      select id
      from user_task_instances
      where user_id = auth.uid()
    )
  );


-- ============================================================================
-- 7. POLICIES — EVIDENCE_ATTACHMENTS
--    Users can read and upload their own evidence.
-- ============================================================================

create policy "evidence_attachments_select_own"
  on evidence_attachments
  for select
  to authenticated
  using (
    uploaded_by = auth.uid()
    or
    task_completion_id in (
      select tc.id
      from task_completions tc
      join user_task_instances uti on tc.user_task_instance_id = uti.id
      where uti.user_id = auth.uid()
    )
  );

create policy "evidence_attachments_insert_own"
  on evidence_attachments
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and
    task_completion_id in (
      select tc.id
      from task_completions tc
      join user_task_instances uti on tc.user_task_instance_id = uti.id
      where uti.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 8. POLICIES — ACTIVITY_LOGS (immutable audit trail)
--    Users can read their own org's logs. Users can insert their own actions.
--    No update or delete allowed.
-- ============================================================================

create policy "activity_logs_select_org"
  on activity_logs
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "activity_logs_insert_own"
  on activity_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());


-- ============================================================================
-- 9. POLICIES — ONBOARDING_PROFILES (V1)
--    Users can read, insert, and update only their own onboarding profile.
-- ============================================================================

create policy "onboarding_profiles_select_own"
  on onboarding_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "onboarding_profiles_insert_own"
  on onboarding_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "onboarding_profiles_update_own"
  on onboarding_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================================
-- 10. POLICIES — CUSTOM_CATEGORIES (V1)
--     All org members can read. The creator can update/delete.
-- ============================================================================

create policy "custom_categories_select_org"
  on custom_categories
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "custom_categories_insert_own"
  on custom_categories
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "custom_categories_update_own"
  on custom_categories
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "custom_categories_delete_own"
  on custom_categories
  for delete
  to authenticated
  using (created_by = auth.uid());


-- ============================================================================
-- 11. POLICIES — CUSTOM_TASKS (V1)
--     All org members can read. The creator can update/delete.
-- ============================================================================

create policy "custom_tasks_select_org"
  on custom_tasks
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "custom_tasks_insert_own"
  on custom_tasks
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "custom_tasks_update_own"
  on custom_tasks
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "custom_tasks_delete_own"
  on custom_tasks
  for delete
  to authenticated
  using (created_by = auth.uid());


-- ============================================================================
-- 12. POLICIES — HIDDEN_ITEMS (V1)
--     All org members can read. The creating user can insert/delete.
--     No update — entries are toggled by insert + delete.
-- ============================================================================

create policy "hidden_items_select_org"
  on hidden_items
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "hidden_items_insert_own"
  on hidden_items
  for insert
  to authenticated
  with check (
    hidden_by = auth.uid()
    and
    organization_id in (
      select organization_id
      from users
      where id = auth.uid()
        and organization_id is not null
    )
  );

create policy "hidden_items_delete_own"
  on hidden_items
  for delete
  to authenticated
  using (hidden_by = auth.uid());


-- ============================================================================
-- 13. POLICIES — ADMIN_SETTINGS (V1)
--     Only usable by the service_role (which bypasses RLS). Regular
--     authenticated users are explicitly denied all access.
-- ============================================================================

create policy "admin_settings_no_access"
  on admin_settings
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);


-- ============================================================================
-- 14. POLICIES — ADMIN_LOGIN_RATE_LIMITS (V1)
--     Only the service_role or backend functions should touch this table.
--     Regular users are denied all access.
-- ============================================================================

create policy "admin_login_rate_limits_no_access"
  on admin_login_rate_limits
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);


-- ============================================================================
-- 15. POLICIES — TASK_REMINDER_DELIVERIES (V1)
--     Users can see their own reminder delivery history. No insert/update
--     from the app — these are written by the edge function.
-- ============================================================================

create policy "task_reminder_deliveries_select_own"
  on task_reminder_deliveries
  for select
  to authenticated
  using (user_id = auth.uid());


-- ============================================================================
-- 16. POLICIES — KNOWLEDGE_ARTICLES
--     All authenticated users can read active articles.
--     Admin functions manage is_active, title, body, etc.
-- ============================================================================

create policy "knowledge_articles_select_active"
  on knowledge_articles
  for select
  to authenticated
  using (is_active = true);


-- ============================================================================
-- NOTES
-- ============================================================================
-- • Policies use `to authenticated` so they only apply to logged-in users.
--   The service_role (used by edge functions and admin APIs) bypasses RLS.
-- • `as restrictive` is used on admin-only tables so that even if a future
--   permissive policy is added, these restrictive policies will still deny
--   access for regular authenticated users.
-- • All policies are idempotent thanks to the initial drop-policy block.
--   This migration can be re-run safely.
-- ============================================================================

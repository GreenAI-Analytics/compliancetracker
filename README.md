# Compliance Tracker

## Sprint Kickoff (April 2026)

This section is the handoff point for the next sprint.

### Current Product Status

- Billing settings now include organization-level payment information capture.
- Settings APIs were hardened for safer organization-scoped updates.
- Social login UI now supports Google and Microsoft OAuth and routes social users to signup completion.
- Supabase project is linked and schema updates for billing fields have been applied.

### Completed In Last Sprint

- Added payment information form and persistence flow:
  - `web/src/app/(app)/billing/page.tsx`
  - `web/src/components/payment-information-form.tsx`
  - `web/src/app/api/settings/payment-information/route.ts`
- Added organization payment columns to schema:
  - `supabase/migrations/20260405161000_add_organization_payment_fields.sql`
  - `supabase/v1-app-schema.sql`
  - `supabase_schema.sql`
- Hardened settings APIs:
  - `web/src/app/api/settings/category-visibility/route.ts`
  - `web/src/app/api/settings/task-reminders/route.ts`
- Updated social login providers from GitHub to Microsoft in login UI:
  - `web/src/components/login-form.tsx`

### Immediate Sprint Priorities

1. Finalize Supabase OAuth provider setup.
2. Validate full social signup flow end-to-end (Google and Microsoft).
3. Add duplicate-protection in complete-signup flow for existing social users.
4. Add automated tests for billing payment-information API and social signup path.
5. Prepare i18n implementation plan (deferred to later sprint execution).

### OAuth Setup Checklist (Required)

Configure the following in Supabase Auth:

- Enable providers:
  - Google
  - Azure (Microsoft)
- Site URL:
  - `http://localhost:3000` (local)
  - production URL (when available)
- Additional Redirect URLs:
  - `http://localhost:3000/login?mode=signup&fresh=1&oauth=1`
  - production equivalent with same query params

Provider callback URL to register in Google and Microsoft apps:

- `https://mqlwmewhkxgystwktcbc.supabase.co/auth/v1/callback`

### Known Follow-Up Gaps

- `complete-signup` currently assumes a new org/user profile creation path; add idempotent behavior for already-provisioned OAuth users.
- Add UX guard: if OAuth user already completed onboarding, redirect directly to dashboard.
- Add integration tests for signup provisioning and billing field persistence.

### Local Runbook

From repo root:

```bash
cd web
npm install
npm run dev
```

Dev server default URL:

- `http://localhost:3000`

### Suggested First Task For Next Sprint

Implement idempotent social signup completion in `web/src/app/api/auth/complete-signup/route.ts` so repeated OAuth callbacks do not create duplicate organization/user/profile records.

This repo will use Supabase to pull rule data from the compliance-rules repository instead of GitHub Actions.

## Goal

Keep the `rules`, `categories`, and `tasks` tables in Supabase aligned with the source data in:

- `https://github.com/greenaianalytics/compliance-rules`

Recommended approach:

1. Use a Supabase Edge Function to fetch rule files from GitHub.
2. Parse the JSON and ignore stub files that only contain `division` and empty `tasks`.
3. Upsert data into Supabase tables.
4. Trigger the function on a schedule from Supabase.

The project now has two sync functions:

- `sync-compliance-rules` for machine-readable task rules
- `sync-compliance-knowledge` for markdown explainer content

## Recommended Architecture

### Source

- Repository: `greenaianalytics/compliance-rules`
- Main data folder: `rules/{country}/nace_*.json`
- Schema reference: `schemas/task_rules.schema.json`

### Sync Runtime

Use a Supabase Edge Function named `sync-compliance-rules`.

The function should:

1. Fetch the list of rule files from GitHub.
2. Download each JSON file.
3. Strip any UTF-8 BOM before parsing.
4. Skip placeholder files shaped like:

```json
{
  "$schema": "../../schemas/task_rules.schema.json",
  "division": "84",
  "tasks": []
}
```

5. Upsert into these tables in order:
   - `rules`
   - `categories`
   - `tasks`

## Supabase Setup

### 1. Create secrets in Supabase

In Supabase project settings, add these secrets for Edge Functions:

- `GITHUB_TOKEN`
  - Optional if the repo stays public
  - Required if you want authenticated GitHub API requests or higher rate limits
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Edge Function Files

This repo now includes the function implementation at:

- `supabase/functions/sync-compliance-rules/index.ts`
- `supabase/config.toml`

The function:

- discovers files via the GitHub Contents API
- strips UTF-8 BOM before parsing
- skips placeholder stub files
- upserts into `rules`, `categories`, and `tasks`

### 3. Set Supabase secrets

Set these before deploying the function:

```bash
supabase secrets set GITHUB_TOKEN=YOUR_GITHUB_PAT
supabase secrets set SUPABASE_URL=YOUR_SUPABASE_URL
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Do not commit any of these values into the repo.

### 4. Deploy the function

```bash
supabase functions deploy sync-compliance-rules
supabase functions deploy sync-compliance-knowledge
```

### 5. Invoke it manually

```bash
supabase functions invoke sync-compliance-rules
supabase functions invoke sync-compliance-knowledge
```

You should get a JSON response with counters like:

- `totalFiles`
- `processedFiles`
- `skippedStubs`
- `rulesUpserted`
- `categoriesUpserted`
- `tasksUpserted`
- `parseFailures`
- `apiFailures`

### 5a. Schedule the function nightly

The scheduler SQL is included at:

- `supabase/schedule-sync.sql`

To apply it:

1. Open the Supabase SQL Editor.
2. Replace `ANON_KEY_HERE` in `supabase/schedule-sync.sql` with your current anon key.
3. Run the full script.

If you see `extension "vault" is not available`, use the updated script in this repo that enables `supabase_vault` (not `vault`).

This creates a nightly `pg_cron` job named `sync-compliance-rules-nightly` that calls:

- `/functions/v1/sync-compliance-rules`

at `30 0 * * *` UTC.

For knowledge content, run:

- `supabase/knowledge-schema.sql` (creates `knowledge_articles`)
- `supabase/schedule-knowledge-sync.sql` (creates `sync-compliance-knowledge-nightly` at `40 0 * * *` UTC)

The second scheduler reuses the same Vault secrets created by `supabase/schedule-sync.sql`.

### 6. Fetch rule files from GitHub

You have two practical options.

#### Option A: GitHub Contents API

Use the GitHub API to walk the `rules` directory by country and collect all `nace_*.json` files.

Base API:

```text
https://api.github.com/repos/greenaianalytics/compliance-rules/contents/rules
```

Then fetch each country directory and each file's `download_url`.

#### Option B: Raw GitHub URLs

If you already know the file paths, fetch directly from raw GitHub URLs:

```text
https://raw.githubusercontent.com/greenaianalytics/compliance-rules/main/rules/ie/nace_62.json
```

Option A is better because it discovers new files automatically.

## Upsert Rules Into Supabase

The sync should upsert records in this order.

### `rules`

Conflict target:

- `(country, nace)`

Payload:

- `country`
- `nace`
- `version`
- `updated_at`

### `categories`

Conflict target:

- `(rule_id, category_id)`

Payload:

- `rule_id`
- `category_id`
- `name`
- `display_order`

### `tasks`

Conflict target:

- `(rule_id, task_id)`

Payload:

- `rule_id`
- `category_id`
- `task_id`
- `title_key`
- `summary_key`
- `law_ref`
- `regulator`
- `frequency`
- `rrule`
- `due_rule`
- `weekend_policy`
- `evidence_required`
- `updated_at`

## Scheduling In Supabase

Use Supabase Scheduled Functions or cron, depending on your project setup.

Recommended schedule:

- `30 0 * * *` UTC

That gives the source repository time to settle after its own daily update cycle.

Suggested behavior:

1. Run nightly.
2. Allow manual invocation for testing.
3. Log counts for processed files, skipped stubs, upserted rules, categories, and tasks.

If you want to schedule by SQL, use a cron job that calls the deployed function URL with a service token. If you prefer the Supabase dashboard scheduler, point it at the `sync-compliance-rules` function and use the same `30 0 * * *` UTC schedule.

## Suggested Edge Function Behavior

Track these counters in logs:

- total files discovered
- valid rule files processed
- stub files skipped
- rules upserted
- categories upserted
- tasks upserted
- parse failures
- API failures

The function should fail only on real fetch or database errors, not on placeholder stub files.

## Notes About The Current Source Data

- Many files in `compliance-rules` are placeholders and do not contain `nace`, `country`, `version`, or `categories`.
- Valid rule files currently contain the full structure needed for import.
- Some files contain a UTF-8 BOM and must be normalized before `JSON.parse`.

## Manual Test Plan

Before enabling the schedule:

1. Invoke the function manually from Supabase.
2. Confirm rows appear in:
   - `rules`
   - `categories`
   - `tasks`
3. Verify conflict upserts by running the function twice.
4. Confirm placeholder files are skipped without failing the job.

## What Was Removed

The previous GitHub-based sync setup was removed:

- local sync script
- GitHub Actions workflow in this repo
- GitHub dispatch workflow in `compliance-rules`
- local secret setup script
- Node sync package files created only for that flow

## Next Step

1. Install and log into the Supabase CLI.
2. Set the three function secrets.
3. Deploy `sync-compliance-rules`.
4. Invoke it once manually and verify rows in the database.
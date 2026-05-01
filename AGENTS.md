# Compliance Tracker — Context Summary

## Quick Start

```bash
cd web
npm install
npm run dev            # Dev server on http://localhost:3000
npm run lint           # ESLint
npx playwright install chromium   # First-time E2E setup
npm run test:e2e       # Playwright headless
npm run test:e2e:ui    # Playwright with UI
```

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 (App Router, React 19) | Web application |
| Backend/Database | Supabase (PostgreSQL + Auth + Storage) | Data, auth, file storage |
| Edge Functions | Supabase Deno Functions | Nightly rule/knowledge sync, email reminders |
| Payments | Stripe | Subscriptions and checkout |
| Email | Resend API | Transactional emails (reminders) |
| Auth Email SMTP | Resend SMTP (or any provider) | Deliverability for Supabase auth emails (signup confirmations, password resets) |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Testing | Playwright | E2E tests |
| Error Monitoring | Sentry | Client-side + server-side error tracking |
| Deployment | Vercel (push to `master`) | Production hosting |

## Project Structure

```
compliancetracker/
├── web/                        # Next.js 16 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout (Space Grotesk + IBM Plex Sans)
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── login/              # Login + signup (LoginForm component)
│   │   │   ├── reset-password/     # Forgot password flow
│   │   │   ├── proxy.ts            # Next.js 16 auth middleware (export async function proxy)
│   │   │   ├── admin/              # Admin console page
│   │   │   ├── (app)/              # Authenticated routes (dashboard, onboarding, billing, settings, knowledge, historical)
│   │   │   │   ├── layout.tsx      # AppShell with sidebar nav
│   │   │   │   ├── dashboard/      # Main dashboard — tasks, calendar, health score, stats
│   │   │   │   ├── onboarding/     # Step-based company setup wizard (scaffold)
│   │   │   │   ├── billing/        # Stripe billing page, payment info form
│   │   │   │   ├── settings/       # Category toggles, hidden tasks, custom tasks, reminders
│   │   │   │   ├── compliance/     # Redirects to /dashboard
│   │   │   │   ├── historical/     # Historical task data
│   │   │   │   └── knowledge/      # Knowledge hub (articles from compliance-knowledge repo)
│   │   │   └── api/                # API routes
│   │   │       ├── auth/complete-signup/     # Post-signup org/user/profile creation (idempotent, CSRF-protected, rate-limited)
│   │   │       ├── task-instances/complete/  # Mark task complete
│   │   │       ├── billing/checkout, portal, webhook
│   │   │       ├── admin/                    # Stats, orgs, billing-price, sync, articles, extend-trial, sponsor-org, test-reminder-email, login, logout
│   │   │       ├── settings/                 # category-visibility, custom-tasks, hidden-tasks, payment-information, task-reminders
│   │   │       ├── countries/                # Country options (falls back to hardcoded list when rules table is empty)
│   │   │       └── nace-options/             # NACE code options (falls back to hardcoded list when rules table is empty)
│   │   ├── components/
│   │   │   ├── login-form.tsx        # Login/signup form (email/password + OAuth + confirmation screen)
│   │   │   ├── app-shell.tsx         # Sidebar + main content layout
│   │   │   ├── task-list.tsx         # Interactive task list with completion
│   │   │   ├── compliance-calendar.tsx # Monthly calendar view
│   │   │   ├── admin-console.tsx     # Full admin panel (6 tabs)
│   │   │   ├── admin-login-form.tsx  # Separate admin auth form
│   │   │   ├── admin-logout-button.tsx
│   │   │   ├── logout-button.tsx
│   │   │   ├── reset-password-form.tsx
│   │   │   ├── billing-actions.tsx
│   │   │   ├── payment-information-form.tsx
│   │   │   ├── settings-category-toggles.tsx
│   │   │   ├── custom-task-manager.tsx
│   │   │   ├── hidden-tasks-manager.tsx
│   │   │   └── task-reminder-settings.tsx
│   │   └── lib/
│   │       ├── supabase/client.ts    # Browser Supabase client (singleton)
│   │       ├── supabase/server.ts    # Server Supabase client (cookie-based)
│   │       ├── supabase/admin.ts     # Admin client (service_role key)
│   │       ├── task-seeder.ts        # Task instance generation engine
│   │       ├── admin-auth.ts         # Admin HMAC session auth
│   │       ├── stripe.ts             # Stripe server client
│   │       ├── csrf.ts               # CSRF token generation & validation
│   │       ├── rate-limit.ts         # IP-based rate limiting
│   │       ├── body-limit.ts         # Request body size limiting
│   │       ├── error-utils.ts        # Sanitized error message helpers
│   │       ├── sentry.ts             # Sentry error monitoring client
│   │       ├── rules-check.ts        # Server-side rules validation
│   │       ├── nace-sections.ts
│   │       └── nace-two-digit-descriptions.ts
│   └── tests/e2e/                    # Playwright tests
├── supabase/
├── supabase_schema.sql               # Base schema (rules, categories, tasks, orgs, users, instances, etc.)
├── supabase/
│   ├── v1-app-schema.sql             # V1 tables (onboarding_profiles, custom_tasks, hidden_items, admin_settings, etc.)
│   ├── config.toml                   # Edge function config (verify_jwt = false)
│   ├── functions/
│   │   ├── sync-compliance-rules/     # Fetches rule JSON from github, upserts rules/categories/tasks
│   │   ├── sync-compliance-knowledge/ # Fetches markdown articles, upserts knowledge_articles
│   │   └── send-task-reminders/       # Sends Resend email digests for due tasks
│   ├── migrations/                   # SQL migrations (payment fields, reminders, stripe, rate limits)
│   ├── schedule-sync.sql
│   └── schedule-knowledge-sync.sql
├── AGENTS.md                         # This file
├── README.md                         # Full project documentation
├── social.md                         # OAuth setup guide (Google + Microsoft)
├── SUPABASE_SETUP.md                 # Supabase project setup guide
└── DEVELOPMEMT_ROADMAP.md
```

## Database Schema (Key Tables)

- **rules** — Country + NACE rule definitions (unique by country, nace)
- **categories** — Categories within rules
- **tasks** — Individual compliance tasks within categories
- **organizations** — Tenant/company records (has Stripe/sponsor fields)
- **users** — User records (linked to auth.users + organizations)
- **onboarding_profiles** — Company setup data (country, nace, trial dates, reminders settings)
- **user_task_instances** — Per-user task instances with calculated due dates
- **task_completions** — Task completion records
- **evidence_attachments** — Uploaded evidence files
- **activity_logs** — Audit trail
- **admin_settings** — Key/value store (billing price, `billing_hidden`, etc.)
- **hidden_items** — Per-org hidden tasks/categories
- **custom_tasks** — User-created custom tasks
- **custom_categories** — User-created custom categories
- **knowledge_articles** — Synced compliance knowledge articles
- **task_reminder_deliveries** — Email reminder delivery deduplication log
- **admin_login_rate_limits** — Rate limiting for admin login attempts

## Supabase Edge Functions

Three Deno functions under `supabase/functions/`:

| Function | Source repo | What it does | Schedule |
|---|---|---|---|
| `sync-compliance-rules` | github.com/greenaianalytics/compliance-rules | Downloads ZIP, parses JSON, upserts rules/categories/tasks | Nightly 00:30 UTC |
| `sync-compliance-knowledge` | github.com/greenaianalytics/compliance-knowledge | Downloads ZIP, parses markdown frontmatter, upserts articles | Nightly 00:40 UTC |
| `send-task-reminders` | (local) | Checks upcoming tasks, builds digest emails, sends via Resend | Nightly |

Deploy: `supabase functions deploy <function-name>` (all have `verify_jwt = false`)

## Supabase Auth Email Configuration ⚠️ Critical for Production

Beyond code, the Supabase **dashboard** controls auth email deliverability, branding, and behavior. Three things must be configured before production use:

### 1. Custom SMTP (fixes spam classification)
Default Supabase emails use a shared sender with low reputation and almost always land in spam. Configure a **custom SMTP provider**:

**In Supabase Dashboard → Authentication → Settings → SMTP Settings:**
- Enable **Custom SMTP**
- **Host:** `smtp.resend.com` (if using Resend; you already have a Resend API key)
- **Port:** `465` (SSL) or `587` (TLS)
- **Username:** `resend`
- **Password:** your Resend API key
- **Sender email:** e.g. `auth@yourdomain.com`
- **Sender name:** `Compliance Tracker`

**DNS records needed** (for your sending domain):
- **SPF:** `v=spf1 include:resend.com ~all`
- **DKIM:** (provided by Resend in their dashboard)
- **DMARC:** `v=DMARC1; p=none; rua=mailto:your-email@yourdomain.com`

These DNS records prove the email is legitimate to Google, Microsoft, etc.

### 2. Email Templates (fixes "phishy" appearance)
**In Supabase Dashboard → Authentication → Email Templates → Confirm Signup:**
Customize the HTML. Include a branded header ("Welcome to Compliance Tracker"), your logo/name, a clear call-to-action button, and a footer with your company name. This avoids the bare/default template that looks like a phishing attempt.

### 3. URL Configuration
**In Supabase Dashboard → Authentication → URL Configuration:**
- **Site URL:** `https://yourproductiondomain.com`
- **Redirect URLs** must include:
  - `https://yourproductiondomain.com/**`
  - `http://localhost:3000/**` (local dev)
- The `emailRedirectTo` option in `signUp()` (set to `${origin}/login`) will override the SITE_URL for confirmation links

## Key Flows

### Signup Flow
1. User visits `/login?mode=signup` or clicks social OAuth
2. **Email/password**: Shows editable email + password + company profile fields
3. **OAuth**: Pre-fills read-only email from provider, shows company fields
4. On submit:
   - **Email**: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/login` } })` — sends confirmation email that redirects to `/login`
   - **Social**: `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/login?mode=signup&fresh=1&oauth=1` } })`
5. `POST /api/auth/complete-signup` creates: organization → user → onboarding_profile → seeds task instances (idempotent, CSRF-protected, rate-limited)
6. **Email users** see a dedicated confirmation screen with:
   - Mail icon and "Verify your email" heading
   - Displays the email the confirmation was sent to
   - "Resend verification email" button (calls `supabase.auth.resend()` with `emailRedirectTo`)
   - "Back to login" link
   - Form fields are cleared and mode toggle is hidden
7. Users confirm via email link → lands on `/login` to sign in

### Country & NACE Dropdown Fallback
- `/api/countries` and `/api/nace-options` query the `rules` table
- When the rules table is empty (e.g., `sync-compliance-rules` hasn't run yet), both endpoints fall back to **hardcoded lists** of all 31 EU/EEA countries and all 88 NACE two-digit codes
- Once rules are synced, they automatically switch to showing only options with available rules

### Task Instance Generation (`lib/task-seeder.ts`)
- Runs on signup completion and as dashboard fallback if no instances exist
- Queries `rules` table by country + NACE
- Generates instances based on `frequency` (one_time, annual, semiannual, quarterly, monthly)
- Calculates due dates using `due_rule` parsing (month=X,day=Y)
- Upserts with `onConflict: "user_id,task_id,cycle_id"` for idempotency

### Admin Panel (`/admin`)
- Independent auth system (HMAC-signed cookie, separate from Supabase)
- Requires `APP_ADMIN_EMAIL`, `APP_ADMIN_PASSWORD`, `APP_ADMIN_SESSION_SECRET` env vars
- 6 tabs: Stats, Organisations, Billing, Reminder, Data Sync, Articles
- Can extend trials, mark orgs as sponsored, set billing price, trigger edge functions, toggle article visibility
- **Hide Billing toggle** in the Billing tab — when ON: billing sidebar link and `/billing` page are hidden from all users, and all active trials are ended immediately. New signups are automatically marked as sponsored.


## Next.js 16 Notes

- **Middleware convention changed**: Use `src/proxy.ts` with `export async function proxy(request: NextRequest)` — NOT `middleware.ts`
- The proxy handles auth session refresh and protected route redirects
- `config.matcher` regex skips Next.js internals and static assets
- Always consult `node_modules/next/dist/docs/` before writing Next.js code

## Environment Variables (`web/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

APP_BASE_URL=http://localhost:3000

# Admin panel (separate from Supabase auth)
APP_ADMIN_EMAIL=admin@example.com
APP_ADMIN_PASSWORD=...
APP_ADMIN_SESSION_SECRET=... (min 16 chars)

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...

# Resend (reminder emails)
RESEND_API_KEY=re_...
REMINDER_FROM_EMAIL=reminders@example.com

# Sentry (error monitoring, optional)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

## Current Status (April 2026)

### Recently Completed
- Forgot password flow (`/reset-password` page + Playwright tests)
- OAuth social login buttons (Google, Microsoft) wired into login form
- Playwright E2E test infrastructure
- Favicon, environment example file
- Vercel project configuration
- **Production hardening audit** — see findings below
- **Country & NACE dropdown fallback** — `/api/countries` and `/api/nace-options` return hardcoded lists when the `rules` table is empty, fixing empty dropdowns before rules are synced
- **Dedicated email verification screen** — replaced tiny inline message with full confirmation UI (mail icon, resend button, back-to-login link)
- **Confirmation email redirect fix** — `signUp()` and `resend()` now pass `emailRedirectTo: \`${origin}/login\`` so the confirmation link always points to the correct environment

### Production Hardening (April 2026)
- **Made `complete-signup` idempotent** — checks for existing onboarding profile before creating org/user/profile; returns early if already exists
- **Added `/api/health` endpoint** — returns status, environment, and configuration checks for monitoring
- **Switched public routes to server client** — `/api/countries` and `/api/nace-options` now use `createSupabaseServerClient()` instead of the service-role admin client
- **Sanitized error messages** — database errors no longer leak to users in countries, nace-options, and task-instances routes
- **Added root-level `.env.example`** — documents all required environment variables for Supabase CLI and edge functions
- **Fixed `supabase_schema.sql` path** — corrected in AGENTS.md file tree (was incorrectly listed inside `supabase/` directory)
- **Added `Hide Billing` feature** — admin Billing tab has a toggle to hide billing from users, end active trials, and mark new signups as sponsored
- **CSRF protection** — `lib/csrf.ts` with token generation/validation; applied to `complete-signup` route with cookie rotation
- **Rate limiting** — `lib/rate-limit.ts` with IP-based request throttling; applied to `complete-signup` route
- **Body size limits** — `lib/body-limit.ts` with configurable request body size enforcement; applied to `complete-signup` route
- **Sentry client** — `lib/sentry.ts` with client-side and server-side initialization (needs `NEXT_PUBLIC_SENTRY_DSN` to activate)

### Known Gaps / Immediate Priorities
1. ~~`complete-signup` route is **not idempotent** — can create duplicate records~~ ✅ Fixed
2. No UX guard to redirect already-onboarded OAuth users to dashboard
3. Full social signup E2E validation not done (requires Supabase OAuth providers enabled)
4. Billing payment-information API integration tests incomplete
5. No i18n implementation plan
6. Task seeding requires rules to be synced first — if `sync-compliance-rules` hasn't run, zero tasks are seeded
7. **No RLS policies** on core tables — all queries use the service_role key; Supabase anon key is underutilised
8. **Onboarding page is a scaffold** — `/onboarding` shows placeholders with no form logic
9. **No evidence upload** — tasks have `evidence_required` flag but upload UI and API are not implemented
10. **CSRF protection is partial** — only applied to `complete-signup` route; other mutation endpoints (settings, admin, billing) still unprotected
11. **Rate limiting is partial** — only applied to `complete-signup` route; other API endpoints lack rate limiting
12. **Body size limits are partial** — only applied to `complete-signup` route; other mutation endpoints lack body limits
13. **Sentry is wired but untested** — `lib/sentry.ts` exists but `NEXT_PUBLIC_SENTRY_DSN` is not configured
14. **Supabase auth emails need SMTP + template configuration** — default emails go to spam and look phishy; must configure Resend SMTP and custom HTML templates in Supabase dashboard

## Testing

```bash
npm run test:e2e           # Headless Playwright tests
npm run test:e2e:ui        # Playwright with interactive UI
npx playwright show-report # View last test report
```

Tests are in `web/tests/e2e/`. Currently only `forgot-password.spec.ts` exists.

## Deployment

Push to `master` → Vercel auto-deploys production. Vercel project is named `compliancetracker`.

**Root Directory** must be set to `web` in Vercel project settings (Settings → General → Root Directory).

Environment variables must be configured in Vercel project settings (Production + Preview).

## Related Repositories

- **compliancetracker** (this repo) — Web app, edge functions, schema
- **github.com/greenaianalytics/compliance-rules** — Source JSON rule data by country/NACE
- **github.com/greenaianalytics/compliance-knowledge** — Source markdown explainer articles

## Key Commands Reference

```bash
cd web && npm run dev        # Start dev server
cd web && npm run lint       # Run ESLint
cd web && npm run build      # Production build
supabase functions deploy <name>  # Deploy edge function
supabase functions invoke <name>  # Manual invocation
# PowerShell requires `;` instead of `&&`:
# cd web; npm run dev
```

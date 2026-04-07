# Compliance Tracker — Web App

Next.js 16 app with Supabase Auth, Stripe billing, and Resend email.

## Local setup

```bash
cd web
cp .env.local.example .env.local   # fill in your values
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

All required variables are documented in `.env.local.example`. Copy it to `.env.local` and fill in each value before running the app. The file is gitignored and will never be committed.

Key variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin key |
| `APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD` | Internal `/admin` console credentials |
| `APP_ADMIN_SESSION_SECRET` | Cookie signing secret (32-byte hex) |
| `STRIPE_SECRET_KEY` | Stripe secret key — use `sk_test_...` locally |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key for reminder emails |
| `REMINDER_FROM_EMAIL` | Verified sender address for reminder emails |
| `APP_BASE_URL` | Base URL used in redirect links (e.g. `http://localhost:3000`) |

## Auth

### Login

- Email/password login at `/login`
- Google and Microsoft OAuth via Supabase
- New users complete a signup form (company name, country, NACE code)

### Forgot password

- "Forgot password?" link on the login page navigates to `/reset-password`
- User enters their email; Supabase sends a reset link
- The reset link redirects back to `/reset-password` with a recovery token
- User sets a new password; on success they are returned to `/login`

**Required Supabase configuration** — add these URLs to Supabase Auth → URL Configuration → Redirect URLs:

```
http://localhost:3000/reset-password
https://<your-production-domain>/reset-password
```

Reset links will fail if the redirect URL is not on the allow-list.

### OAuth (Google / Microsoft)

Add to Supabase Auth → URL Configuration → Redirect URLs:

```
http://localhost:3000/login?mode=signup&fresh=1&oauth=1
https://<your-production-domain>/login?mode=signup&fresh=1&oauth=1
```

Provider callback URL to register in Google and Microsoft developer consoles:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright end-to-end tests (headless) |
| `npm run test:e2e:ui` | Run Playwright with interactive UI |

## End-to-end tests

Playwright tests live in `tests/e2e/`. The test runner starts `next dev` automatically.

```bash
npm run test:e2e
```

First run requires the Playwright browser to be installed:

```bash
npx playwright install chromium
```

Current test coverage:

- `forgot-password.spec.ts` — verifies the forgot-password link on login, form submission, and success message (Supabase reset endpoint is stubbed)

## Deployment

The app is deployed on Vercel (project: `compliancetracker`). Pushing to `master` triggers an automatic production deployment.

Ensure all environment variables listed in `.env.local.example` are set in the Vercel project settings before deploying.

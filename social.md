# Social Login Setup Guide

This project supports Google and Microsoft (Azure) OAuth login. The buttons
are already wired up in `login-form.tsx` — this guide covers the external
configuration needed to make them work in production.

**Production domain:** `https://compliancetracker.greenaianalytics.org`

---

## 1. Prerequisites

Confirm these environment variables exist in Vercel (Production) and your
`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

## 2. Enable Providers in Supabase Dashboard

1. Go to **Authentication → Providers**
2. Enable **Google** — leave the Client ID / Secret blank for now
3. Enable **Azure (Microsoft)** — leave fields blank for now
4. Click **Save**

Supabase will display a **callback URL** for each provider. Copy both:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

You'll paste these into Google Cloud Console and Azure Portal in steps 4 and 5.

---

## 3. Configure Supabase URL Settings

Go to **Authentication → URL Configuration** and set:

| Setting | Value |
|---|---|
| **Site URL** | `https://compliancetracker.greenaianalytics.org` |
| **Redirect URLs** | `http://localhost:3000/**` |
| | `http://localhost:3000/login?mode=signup&fresh=1&oauth=1` |
| | `https://compliancetracker.greenaianalytics.org/**` |
| | `https://compliancetracker.greenaianalytics.org/login?mode=signup&fresh=1&oauth=1` |

> **Why the exact query string matters:** The frontend calls
> `supabase.auth.signInWithOAuth()` with
> `redirectTo: \`${origin}/login?mode=signup&fresh=1&oauth=1\``.
> If that full URL (including query params) is not in the Redirect URLs list,
> the OAuth callback will fail with "No redirect allowed".

---

## 4. Configure Google OAuth App

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

### 4a. Create a new OAuth 2.0 Client ID (or use existing)

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Compliance Tracker` (or similar)

### 4b. Configure Authorized Redirect URIs

Add this exact URI:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

### 4c. Configure Authorized JavaScript Origins

Add these origins:

```
http://localhost:3000
https://compliancetracker.greenaianalytics.org
```

### 4d. Copy credentials to Supabase

1. Copy the **Client ID** and **Client Secret** from Google
2. In Supabase → **Authentication → Providers → Google**, paste them
3. Click **Save**

### 4e. OAuth consent screen (if first time)

If this is a new app, you'll also need to configure the OAuth consent screen:
- User type: **External**
- Add the scopes: `email`, `profile`, `openid`
- Add test users (your email) for testing before publishing

---

## 5. Configure Microsoft (Azure) OAuth App

In [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade):

### 5a. Create or open your App Registration

1. Go to **App registrations → New registration**
2. Name: `Compliance Tracker`
3. Supported account types: **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)**
4. Redirect URI: **Web** → `https://<project-ref>.supabase.co/auth/v1/callback`
5. Click **Register**

### 5b. Create a Client Secret

1. Go to **Certificates & secrets → Client secrets → New client secret**
2. Description: `Supabase OAuth`
3. Expires: 24 months (or your preference)
4. Click **Add**
5. **Copy the secret value immediately** — it won't be shown again

### 5c. Copy credentials to Supabase

In Supabase → **Authentication → Providers → Azure**:

| Supabase field | Azure value |
|---|---|
| **Client ID** | Application (client) ID |
| **Client Secret** | The secret you copied in step 5b |
| **Azure Tenant ID** | Use `common` for multi-tenant (most common) or your specific tenant ID |

Click **Save**.

---

## 6. Verify the Setup

### Local development test

1. Run `cd web && npm run dev`
2. Open `http://localhost:3000/login`
3. Click **Continue with Google** or **Continue with Microsoft**
4. Authenticate with the provider
5. You should land on `/login?mode=signup&fresh=1&oauth=1`
6. Fill in company details and submit → redirected to `/dashboard`

### Production test

1. Visit `https://compliancetracker.greenaianalytics.org/login`
2. Repeat steps 3–6 above

### Expected behavior

| Scenario | Result |
|---|---|
| **New user, first OAuth login** | Lands on signup form with company fields, email pre-filled |
| **Existing user, already onboarded** | Redirected to `/dashboard` |
| **Existing user, not yet onboarded** | Lands on signup form (same as new user) |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "No redirect allowed" or blank screen after OAuth | Redirect URL not allow-listed in Supabase | Add the full URL with query params to Supabase → Auth → Redirect URLs |
| Provider shows error after authenticating | Callback URI mismatch | Verify the callback URL in Google/MS matches `https://<project-ref>.supabase.co/auth/v1/callback` |
| Google shows "Access blocked" | OAuth consent screen not configured | Set up consent screen in Google Cloud Console (External, add test users) |
| Redirected to wrong URL after login | `NEXT_PUBLIC_SUPABASE_URL` incorrect | Check the env var in Vercel / `.env.local` |
| Social button does nothing | Supabase env vars missing in client | Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set |
| Loop back to login after OAuth | complete-signup route failing | Check Vercel logs; verify `SUPABASE_SERVICE_ROLE_KEY` is set |

---

## 8. Code References

| File | Role |
|---|---|
| `web/src/components/login-form.tsx` | Social login buttons + OAuth redirect handling |
| `web/src/app/api/auth/complete-signup/route.ts` | Post-signup org/user/profile creation (now idempotent) |
| `web/src/proxy.ts` | Auth session refresh + protected route middleware |
| `web/src/lib/csrf.ts` | CSRF protection (applied to complete-signup) |

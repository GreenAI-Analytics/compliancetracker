# Social Login Setup Guide

This project already has social login buttons and OAuth redirect handling in the app.

Supported providers:
- Google
- Microsoft (Azure)

## 1. Confirm app environment variables

Set these in local and production environments:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Notes:
- The browser auth client depends on NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Server routes (including signup completion) depend on SUPABASE_SERVICE_ROLE_KEY.

## 2. Enable providers in Supabase

In Supabase dashboard:
1. Go to Authentication -> Providers.
2. Enable Google.
3. Enable Azure (Microsoft).
4. Save.

For each provider, Supabase will show the values you must copy into that provider's app registration.

## 3. Configure Supabase URL settings

In Supabase dashboard:
1. Go to Authentication -> URL Configuration.
2. Set Site URL for local development:
   - http://localhost:3000
3. Add Redirect URLs:
   - http://localhost:3000/login?mode=signup&fresh=1&oauth=1
   - https://compliancetracker.greenaianalytics.org/login?mode=signup&fresh=1&oauth=1
   - https://web-*.vercel.app/login?mode=signup&fresh=1&oauth=1 (optional for direct preview testing)

Why this exact redirect matters:
- The frontend calls signInWithOAuth with redirectTo set to /login?mode=signup&fresh=1&oauth=1.
- If this URL is not allow-listed, OAuth callback will fail.

## 4. Configure Google OAuth app

In Google Cloud Console:
1. Create or open your OAuth client.
2. Add Authorized redirect URI:
   - https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
3. Add Authorized JavaScript origins (if required by your setup):
   - http://localhost:3000
   - https://compliancetracker.greenaianalytics.org
4. Copy Google Client ID and Client Secret.
5. Paste them into Supabase Google provider settings.
6. Save provider settings in Supabase.

## 5. Configure Microsoft (Azure) OAuth app

In Azure Portal (App registrations):
1. Create or open your app registration.
2. Add Redirect URI (Web):
   - https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
3. Ensure Accounts setting matches your desired tenant scope.
4. Create a client secret and copy it immediately.
5. Copy Application (client) ID, client secret, and tenant info.
6. Paste required values into Supabase Azure provider settings.
7. Save provider settings in Supabase.

## 6. Production deployment checks (Vercel)

In Vercel project environment variables (Production):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Then redeploy production so the env vars are active in the latest deployment.

If Vercel deployment protection is enabled, users must pass Vercel auth first before app OAuth flow starts.

## 7. End-to-end test flow

Test Google and Microsoft separately:
1. Open /login.
2. Click social button.
3. Authenticate with provider.
4. Confirm you return to /login?mode=signup&fresh=1&oauth=1.
5. Complete signup fields and submit.
6. Confirm redirect to /dashboard.

Expected behavior:
- New social user lands in signup completion mode.
- Existing authenticated user should continue into the app without re-auth prompts.

## 8. Known current gap

The current complete-signup route is not fully idempotent for repeated OAuth callbacks.

Impact:
- Re-running social signup for an already provisioned user can fail or try duplicate records.

Recommended follow-up:
- Make complete-signup idempotent by checking for existing user/org/onboarding records and updating instead of always inserting.

## 9. Troubleshooting quick checks

If social login fails, check these first:
1. Provider callback URL exactly matches Supabase callback URL.
2. Supabase Redirect URLs include the full login URL with query params.
3. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are present in deployment.
4. Browser is not blocking third-party auth popup/redirect flow.
5. You are testing on an allowed domain (localhost or configured production domain).

---

Implementation references in this repo:
- web/src/components/login-form.tsx
- web/src/app/api/auth/complete-signup/route.ts
- web/src/proxy.ts
- README.md (OAuth setup checklist section)

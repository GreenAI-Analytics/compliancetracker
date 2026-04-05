# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Configure:
   - **Project name:** `compliance-tracker` (or your choice)
   - **Database password:** Generate strong password (save it)
   - **Region:** Choose closest to your users
   - **Pricing:** Free or Pro plan
5. Click "Create new project" (takes ~2 minutes)

## Step 2: Get Connection Details

Once project is ready:
1. Go to **Settings** → **Database**
2. Copy these details (you'll need them for Next.js):
   - **Host:** `[project-ref].supabase.co`
   - **Port:** `5432`
   - **Database:** `postgres`
   - **User:** `postgres`
   - **Password:** Your database password

3. Go to **Settings** → **API**
4. Copy:
   - **Project URL (anon key):** `https://[project-ref].supabase.co`
   - **anon/public key:** (for client-side)
   - **service_role key:** (secret, for server-side)

## Step 3: Deploy Schema

### Option A: Using Supabase Dashboard SQL Editor

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `supabase_schema.sql`
4. Paste into the editor
5. Click **Run** (or Cmd+Enter)
6. Wait for completion ✓

### Option B: Using `psql` CLI (if you have it installed)

```bash
psql postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres < supabase_schema.sql
```

## Step 4: Configure Authentication

In Supabase dashboard:

1. Go to **Authentication** → **Providers**
2. Enable:
   - **Email/Password** (for sign up/login)
   - Optionally: Google, GitHub for OAuth
3. Go to **URL Configuration**
4. Set **Site URL:** `http://localhost:3000` (for local dev)
5. Set **Redirect URLs:**
   - `http://localhost:3000/**`
   - `https://yourdomain.vercel.app/**` (for production)

## Step 5: Create Storage Bucket for Evidence

1. Go to **Storage**
2. Click **Create new bucket**
3. Name: `evidence` (public or private, your choice)
4. Configure permissions for the bucket

## Step 6: Environment Variables

Create `.env.local` in your Next.js project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Optional: For local development
SUPABASE_DB_HOST=[host]
SUPABASE_DB_PASSWORD=[password]
SUPABASE_DB_USER=postgres
SUPABASE_DB_NAME=postgres
```

> ⚠️ Never commit `.env.local` to git. Add to `.gitignore`

## Step 7: Verify Schema

In Supabase SQL Editor, run:

```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Count tables (should be ~11)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
```

## Next Steps

1. ✅ Schema deployed
2. 🔜 Create Next.js project
3. 🔜 Install Supabase client library
4. 🔜 Build API routes
5. 🔜 Build React components

---

## Troubleshooting

**Error: "relation already exists"**
- Schema may have been applied twice
- Check your tables in SQL Editor

**Connection timeout**
- Ensure your IP is whitelisted (if applicable)
- Verify database password in Settings

**Auth not working**
- Check URL Configuration matches your app URL
- Verify anon key is in `.env.local`

## Useful Supabase Commands

```sql
-- Check for nulls in key fields
SELECT * FROM rules WHERE country IS NULL OR nace IS NULL;

-- Find duplicate rules
SELECT country, nace, COUNT(*) FROM rules 
GROUP BY country, nace HAVING COUNT(*) > 1;

-- Test RLS policies (if enabled)
SELECT COUNT(*) FROM organizations;  -- Should return org's own data
```

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "missing" | "error"> = {};
  let healthy = true;

  // Check Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  checks.supabase_config =
    supabaseUrl && supabaseAnonKey ? "ok" : "missing";

  if (checks.supabase_config !== "ok") healthy = false;

  // Check Supabase service role (needed for admin operations)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  checks.service_role = serviceRoleKey ? "ok" : "missing";

  // Check admin panel configuration
  const adminEmail = process.env.APP_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.APP_ADMIN_PASSWORD?.trim();
  const adminSecret = process.env.APP_ADMIN_SESSION_SECRET?.trim();
  checks.admin_config =
    adminEmail && adminPassword && adminSecret && adminSecret.length >= 16
      ? "ok"
      : "missing";

  // Check Stripe configuration (optional — billing may be off)
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  checks.stripe_config = stripeKey ? "ok" : "missing";

  // Check Resend configuration (optional — reminders can be off)
  const resendKey = process.env.RESEND_API_KEY?.trim();
  checks.resend_config = resendKey ? "ok" : "missing";

  // Check APP_BASE_URL
  const baseUrl = process.env.APP_BASE_URL?.trim();
  checks.base_url = baseUrl ? "ok" : "missing";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "unknown",
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}

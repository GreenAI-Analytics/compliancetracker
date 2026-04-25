import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

const ALLOWED_DAYS = new Set([1, 3, 7, 14, 30]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF validation
  const csrf = validateCsrfToken(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 });
  }

  // Rate limiting by user ID
  const rateLimit = rateLimitMiddleware(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const {
    data: body,
    error: bodyError,
    status: bodyStatus,
  } = await parseBody<{ enabled?: boolean; daysBefore?: number }>(request);

  if (bodyError) {
    return NextResponse.json(
      { error: bodyError },
      { status: bodyStatus ?? 400 },
    );
  }

  const enabled = body?.enabled;
  const daysBefore = body?.daysBefore;

  if (typeof enabled !== "boolean" || typeof daysBefore !== "number") {
    return NextResponse.json(
      { error: "enabled (boolean) and daysBefore (number) are required." },
      { status: 400 },
    );
  }

  if (!ALLOWED_DAYS.has(daysBefore)) {
    return NextResponse.json(
      { error: "daysBefore must be one of: 1, 3, 7, 14, 30" },
      { status: 400 },
    );
  }

  // TODO: Switch to server client after RLS policies are implemented
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.user_id) {
    return NextResponse.json(
      { error: "Organization profile not found" },
      { status: 404 },
    );
  }

  const { error: updateError } = await admin
    .from("onboarding_profiles")
    .update({
      task_reminders_enabled: enabled,
      task_reminder_days_before: daysBefore,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to update task reminders:", updateError);
    return NextResponse.json(
      { error: "Failed to update reminder settings" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

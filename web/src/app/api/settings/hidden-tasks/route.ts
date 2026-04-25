import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

export async function DELETE(request: NextRequest) {
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
  } = await parseBody<{ taskRef?: string }>(request);
  if (bodyError) {
    return NextResponse.json(
      { error: bodyError },
      { status: bodyStatus ?? 400 },
    );
  }

  const taskRef = body?.taskRef?.trim();

  if (!taskRef) {
    return NextResponse.json({ error: "taskRef is required" }, { status: 400 });
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
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization profile not found" },
      { status: 404 },
    );
  }

  const { error: deleteError } = await admin
    .from("hidden_items")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("item_type", "task")
    .eq("item_ref", taskRef);

  if (deleteError) {
    console.error("Failed to delete hidden task:", deleteError);
    return NextResponse.json(
      { error: "Failed to remove hidden task" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

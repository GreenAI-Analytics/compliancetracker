import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

export async function POST(request: NextRequest) {
  // 1. CSRF protection (safe methods skip automatically)
  const csrfCheck = validateCsrfToken(request);
  if (!csrfCheck.valid) {
    return NextResponse.json({ error: csrfCheck.error }, { status: 403 });
  }

  // 2. Authenticate user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Rate limit by user ID
  const rateCheck = rateLimitMiddleware(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  // 4. Parse and validate the request body (with size limit)
  const parsed = await parseBody<{ instanceId?: string }>(request);
  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status ?? 400 },
    );
  }
  const instanceId = parsed.data?.instanceId;

  if (!instanceId) {
    return NextResponse.json(
      { error: "instanceId is required" },
      { status: 400 },
    );
  }

  // 5. Use admin client for DB operations (RLS is not yet deployed;
  //    once RLS is active, switch to createSupabaseServerClient)
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from("user_task_instances")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Task instance not found" },
      { status: 404 },
    );
  }

  // 6. Rotate CSRF token on the success response
  const response = NextResponse.json({ ok: true, id: data.id });
  setCsrfCookie(response);
  return response;
}

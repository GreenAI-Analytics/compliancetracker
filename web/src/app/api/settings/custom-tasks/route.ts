import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

const CUSTOM_CATEGORY_NAME = "Private Tasks";

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
  } = await parseBody<{
    title?: string;
    dueDate?: string | null;
    isRecurring?: boolean;
    recurringInterval?: string | null;
    priority?: string | null;
  }>(request);

  if (bodyError) {
    return NextResponse.json(
      { error: bodyError },
      { status: bodyStatus ?? 400 },
    );
  }

  const title = body?.title?.trim();
  const dueDate = body?.dueDate ?? null;
  const isRecurring = body?.isRecurring === true;
  const recurringInterval = isRecurring
    ? (body?.recurringInterval ?? null)
    : null;
  const priority = body?.priority ?? "medium";

  if (!title) {
    return NextResponse.json(
      { error: "Task title is required" },
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
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Organization profile not found" },
      { status: 404 },
    );
  }

  let categoryId: string | null = null;

  const { data: existingCategory } = await admin
    .from("custom_categories")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("name", CUSTOM_CATEGORY_NAME)
    .maybeSingle();

  if (existingCategory?.id) {
    categoryId = existingCategory.id as string;
  } else {
    const { data: createdCategory, error: createCategoryError } = await admin
      .from("custom_categories")
      .insert({
        organization_id: profile.organization_id,
        name: CUSTOM_CATEGORY_NAME,
        description: "Organization-specific custom tasks",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createCategoryError || !createdCategory?.id) {
      console.error("Failed to create custom category:", createCategoryError);
      return NextResponse.json(
        { error: "Failed to create custom category" },
        { status: 500 },
      );
    }

    categoryId = createdCategory.id as string;
  }

  const metadata = JSON.stringify({ isRecurring, recurringInterval, priority });

  const { error: createTaskError } = await admin.from("custom_tasks").insert({
    category_id: categoryId,
    organization_id: profile.organization_id,
    title,
    details: metadata,
    due_date: dueDate,
    status: "pending",
    created_by: user.id,
  });

  if (createTaskError) {
    console.error("Failed to create custom task:", createTaskError);
    return NextResponse.json(
      { error: "Failed to create custom task" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

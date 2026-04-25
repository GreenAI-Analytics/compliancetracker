import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    setCsrfCookie(response);
    return response;
  }

  // CSRF validation
  const csrf = validateCsrfToken(request);
  if (!csrf.valid) {
    const response = NextResponse.json({ error: csrf.error }, { status: 403 });
    setCsrfCookie(response);
    return response;
  }

  // Rate limiting
  const rateCheck = rateLimitMiddleware(user.id);
  if (!rateCheck.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
    return response;
  }

  const parsed = await parseBody<{ categoryRef?: string; enabled?: boolean }>(
    request,
  );
  if (parsed.error) {
    const response = NextResponse.json(
      { error: parsed.error },
      { status: parsed.status ?? 400 },
    );
    setCsrfCookie(response);
    return response;
  }
  const body = parsed.data!;

  const categoryRef = body.categoryRef?.trim();
  const enabled = body.enabled;

  if (!categoryRef || typeof enabled !== "boolean") {
    const response = NextResponse.json(
      { error: "categoryRef and enabled are required" },
      { status: 400 },
    );
    setCsrfCookie(response);
    return response;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    const response = NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
    setCsrfCookie(response);
    return response;
  }

  // TODO: Switch to server client (createSupabaseServerClient) after RLS policies are in place
  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("organization_id, country, nace")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    const response = NextResponse.json(
      { error: "Organization profile not found" },
      { status: 404 },
    );
    setCsrfCookie(response);
    return response;
  }

  // Only allow hiding categories that exist for the organization's active rule.
  if (!enabled) {
    const { data: rule, error: ruleError } = await admin
      .from("rules")
      .select("id")
      .eq("country", profile.country)
      .eq("nace", profile.nace)
      .maybeSingle();

    if (ruleError || !rule?.id) {
      const response = NextResponse.json(
        { error: "Rule not found for organization profile" },
        { status: 404 },
      );
      setCsrfCookie(response);
      return response;
    }

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .select("category_id")
      .eq("rule_id", rule.id)
      .eq("category_id", categoryRef)
      .maybeSingle();

    if (categoryError || !category?.category_id) {
      const response = NextResponse.json(
        { error: "Invalid category for organization profile" },
        { status: 400 },
      );
      setCsrfCookie(response);
      return response;
    }
  }

  if (enabled) {
    const { error } = await admin
      .from("hidden_items")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("item_type", "category")
      .eq("item_ref", categoryRef);

    if (error) {
      console.error("Failed to delete hidden item:", error.message);
      const response = NextResponse.json(
        { error: "Database error" },
        { status: 500 },
      );
      setCsrfCookie(response);
      return response;
    }

    const response = NextResponse.json({ ok: true });
    setCsrfCookie(response);
    return response;
  }

  const { error } = await admin.from("hidden_items").upsert(
    {
      organization_id: profile.organization_id,
      hidden_by: user.id,
      item_type: "category",
      item_ref: categoryRef,
    },
    { onConflict: "organization_id,item_type,item_ref" },
  );

  if (error) {
    console.error("Failed to upsert hidden item:", error.message);
    const response = NextResponse.json(
      { error: "Database error" },
      { status: 500 },
    );
    setCsrfCookie(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

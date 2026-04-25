import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedUserTasks } from "@/lib/task-seeder";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware, extractIp } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

type SignupBody = {
  authUserId: string;
  email: string;
  companyName: string;
  companyAddress: string;
  incorporationDate: string;
  country: string;
  naceCode: string;
};

export async function POST(request: NextRequest) {
  // ── 1. CSRF validation ──────────────────────────────────────────────────
  const csrfCheck = validateCsrfToken(request);
  if (!csrfCheck.valid) {
    return NextResponse.json(
      { error: csrfCheck.error || "CSRF validation failed" },
      { status: 403 },
    );
  }

  // ── 2. Rate limiting (IP-based — no user session exists yet) ────────────
  const ip = extractIp(request);
  const rateCheck = rateLimitMiddleware(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  // ── 3. Parse & validate body ────────────────────────────────────────────
  const {
    data: body,
    error: bodyError,
    status: bodyStatus,
  } = await parseBody<SignupBody>(request);
  if (bodyError) {
    return NextResponse.json(
      { error: bodyError },
      { status: bodyStatus ?? 400 },
    );
  }

  const {
    authUserId,
    email,
    companyName,
    companyAddress,
    incorporationDate,
    country,
    naceCode,
  } = body!;

  if (
    !authUserId ||
    !email ||
    !companyName ||
    !incorporationDate ||
    !country ||
    !naceCode
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // ── 4. Database setup ──────────────────────────────────────────────────
  // NOTE: This route uses the admin client directly because it's called
  // before the user's Supabase auth session is fully established. A server
  // client (cookie-based) is not available at this point.
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Verify the auth user actually exists in Supabase Auth
  const { data: authUser, error: authError } =
    await supabase.auth.admin.getUserById(authUserId);
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Invalid auth user" }, { status: 400 });
  }

  // ── 5. Idempotency check — if user already has an onboarding profile, return success ──
  const { data: existingProfile } = await supabase
    .from("onboarding_profiles")
    .select("id, organization_id")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (existingProfile) {
    const response = NextResponse.json({
      success: true,
      organizationId: existingProfile.organization_id,
      alreadyExisted: true,
    });
    setCsrfCookie(response); // rotate token on success
    return response;
  }

  // Check if billing is hidden (admin setting) — if so, mark new orgs as sponsored
  const { data: billingHiddenRow } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "billing_hidden")
    .maybeSingle();
  const billingHidden = billingHiddenRow?.value === "true";

  // ── 6. Create organisation (sponsored if billing is hidden) ─────────────
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: companyName,
      country,
      nace: naceCode,
      ...(billingHidden
        ? { is_sponsored: true, sponsored_reason: "Billing disabled by admin" }
        : {}),
    })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("Failed to create organisation:", orgError?.message);
    return NextResponse.json(
      { error: "Failed to create organisation" },
      { status: 500 },
    );
  }

  // ── 7. Create user record ──────────────────────────────────────────────
  const { error: userError } = await supabase.from("users").insert({
    id: authUserId,
    email,
    organization_id: org.id,
    role: "admin",
  });

  if (userError) {
    console.error("Failed to create user record:", userError.message);
    // Roll back the organisation if user insert fails
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json(
      { error: "Failed to create user record" },
      { status: 500 },
    );
  }

  // 8. Set organisation created_by
  await supabase
    .from("organizations")
    .update({ created_by: authUserId })
    .eq("id", org.id);

  // ── 9. Create onboarding profile ───────────────────────────────────────
  const signupDate = new Date();
  // Sponsored orgs don't need a trial period
  const trialEndsAt = billingHidden
    ? signupDate
    : new Date(signupDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: profileError } = await supabase
    .from("onboarding_profiles")
    .insert({
      user_id: authUserId,
      organization_id: org.id,
      company_name: companyName,
      business_address: companyAddress || null,
      incorporation_date: incorporationDate,
      country,
      nace: naceCode,
      operating_countries: [country],
      modules_selected: [],
      onboarding_completed: false,
      signup_date: signupDate.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    });

  if (profileError) {
    console.error("Failed to create onboarding profile:", profileError.message);
    return NextResponse.json(
      { error: "Failed to create onboarding profile" },
      { status: 500 },
    );
  }

  // ── 10. Seed task instances (best-effort; don't fail signup if this errors) ──
  await seedUserTasks(supabase, authUserId, org.id, country, naceCode);

  // ── 11. Success response with token rotation ───────────────────────────
  const response = NextResponse.json({ success: true, organizationId: org.id });
  setCsrfCookie(response); // rotate token on success
  return response;
}

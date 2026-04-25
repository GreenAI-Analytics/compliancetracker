import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

type OnboardingUpdateBody = {
  company_name?: string;
  business_address?: string | null;
  incorporation_date?: string | null;
  employee_count?: number | null;
  country?: string;
  nace?: string;
  operating_countries?: string[];
  modules_selected?: string[];
  onboarding_completed?: boolean;
  task_reminders_enabled?: boolean;
  task_reminder_days_before?: number;
};

export async function PATCH(request: NextRequest) {
  // 1. CSRF protection
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
  const parsed = await parseBody<OnboardingUpdateBody>(request);
  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status ?? 400 },
    );
  }

  const body = parsed.data;
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: "Request body is empty" },
      { status: 400 },
    );
  }

  // 5. Build the update payload — only include provided fields
  const updateFields: Record<string, unknown> = {};
  const allowedFields = [
    "company_name",
    "business_address",
    "incorporation_date",
    "employee_count",
    "country",
    "nace",
    "operating_countries",
    "modules_selected",
    "onboarding_completed",
    "task_reminders_enabled",
    "task_reminder_days_before",
  ] as const;

  for (const field of allowedFields) {
    if (body[field as keyof OnboardingUpdateBody] !== undefined) {
      updateFields[field] = body[field as keyof OnboardingUpdateBody];
    }
  }

  // Validate country/nace format if provided
  if (updateFields.country !== undefined) {
    if (
      typeof updateFields.country !== "string" ||
      updateFields.country.length !== 2
    ) {
      return NextResponse.json(
        { error: "Country must be a 2-letter ISO code" },
        { status: 400 },
      );
    }
  }

  if (updateFields.nace !== undefined) {
    if (
      typeof updateFields.nace !== "string" ||
      !/^[0-9]{2}$/.test(updateFields.nace)
    ) {
      return NextResponse.json(
        { error: "NACE must be a 2-digit code" },
        { status: 400 },
      );
    }
  }

  if (updateFields.employee_count !== undefined) {
    const ec = updateFields.employee_count;
    if (typeof ec !== "number" || ec < 0 || !Number.isInteger(ec)) {
      return NextResponse.json(
        { error: "Employee count must be a positive integer" },
        { status: 400 },
      );
    }
  }

  // 6. Fetch the existing profile (also verifies the user exists)
  // TODO: Switch to server client after RLS policies are implemented
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: existingProfile, error: fetchError } = await admin
    .from("onboarding_profiles")
    .select("id, organization_id, company_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch existing profile:", fetchError);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }

  if (!existingProfile) {
    return NextResponse.json(
      { error: "Onboarding profile not found. Please complete signup first." },
      { status: 404 },
    );
  }

  // If onboarding_completed is true, validate required fields
  if (updateFields.onboarding_completed === true) {
    const requiredFields = [
      "company_name",
      "country",
      "nace",
      "modules_selected",
    ];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const existingValue =
        existingProfile[field as keyof typeof existingProfile];
      const updateValue = updateFields[field];
      const value = updateValue !== undefined ? updateValue : existingValue;

      if (!value || (Array.isArray(value) && value.length === 0)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields to complete onboarding: ${missingFields.join(", ")}`,
        },
        { status: 400 },
      );
    }
  }

  // 7. Update the onboarding profile
  const { error: updateError } = await admin
    .from("onboarding_profiles")
    .update({
      ...updateFields,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to update onboarding profile:", updateError);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }

  // 8. If company_name changed, also update the organisation name
  if (updateFields.company_name) {
    const { error: orgUpdateError } = await admin
      .from("organizations")
      .update({ name: updateFields.company_name as string })
      .eq("id", existingProfile.organization_id);

    if (orgUpdateError) {
      console.error("Failed to update organisation name:", orgUpdateError);
      // Non-fatal — the profile update succeeded
    }
  }

  // 9. Success response with CSRF token rotation
  const response = NextResponse.json({ success: true });
  setCsrfCookie(response);
  return response;
}

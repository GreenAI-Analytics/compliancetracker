import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("onboarding_profiles")
    .select(
      `id, company_name, country, nace, employee_count,
       signup_date, trial_ends_at, onboarding_completed,
       organization_id,
       organizations!inner(id, name, is_sponsored, sponsored_reason),
       users!inner(id, email, full_name)`
    )
    .order("signup_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orgs = (data ?? []).map((row) => {
    const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
    const trialActive = trialEndsAt ? trialEndsAt > new Date(now) : false;
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
      : 0;

    const orgRelation = firstRelation(
      row.organizations as unknown as { is_sponsored: boolean; sponsored_reason: string | null }[]
    );
    const userRelation = firstRelation(
      row.users as unknown as { email: string; full_name: string | null }[]
    );

    return {
      profileId: row.id,
      orgId: row.organization_id,
      companyName: row.company_name,
      country: row.country,
      nace: row.nace,
      employeeCount: row.employee_count,
      signupDate: row.signup_date,
      trialEndsAt: row.trial_ends_at,
      trialActive,
      daysLeft,
      onboardingCompleted: row.onboarding_completed,
      isSponsored: orgRelation?.is_sponsored ?? false,
      sponsoredReason: orgRelation?.sponsored_reason ?? null,
      userEmail: userRelation?.email ?? "",
      userName: userRelation?.full_name ?? null,
    };
  });

  return NextResponse.json({ orgs });
}

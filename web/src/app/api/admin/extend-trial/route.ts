import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const body = (await request.json()) as { orgId?: string; days?: number };
  const { orgId, days } = body;

  if (!orgId || !days || days < 1 || days > 365) {
    return NextResponse.json({ error: "orgId and days (1-365) are required." }, { status: 400 });
  }

  // Get current trial_ends_at
  const { data: profile, error: fetchErr } = await supabase
    .from("onboarding_profiles")
    .select("trial_ends_at")
    .eq("organization_id", orgId)
    .single();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  const base = profile.trial_ends_at
    ? new Date(Math.max(new Date(profile.trial_ends_at).getTime(), Date.now()))
    : new Date();
  const newTrialEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const { error: updateErr } = await supabase
    .from("onboarding_profiles")
    .update({ trial_ends_at: newTrialEnd.toISOString(), updated_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, newTrialEnd: newTrialEnd.toISOString() });
}

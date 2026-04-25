import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const SETTING_KEY = "billing_hidden";

export async function GET() {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  return NextResponse.json({ hidden: data?.value === "true" });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const body = (await request.json()) as { hidden?: boolean };
  const hidden = Boolean(body.hidden);

  // Upsert the billing_hidden setting
  const { error: upsertErr } = await supabase.from("admin_settings").upsert(
    { key: SETTING_KEY, value: String(hidden), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // When hiding billing, end all active trials immediately
  if (hidden) {
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("onboarding_profiles")
      .update({ trial_ends_at: now, updated_at: now })
      .gt("trial_ends_at", now);

    if (updateErr) {
      // Non-fatal — log but still report success for the setting itself
      console.error("Failed to end active trials:", updateErr.message);
    }
  }

  return NextResponse.json({ ok: true, hidden });
}

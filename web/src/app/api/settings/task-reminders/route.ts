import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const body = (await request.json().catch(() => null)) as
    | { enabled?: boolean; daysBefore?: number }
    | null;

  const enabled = body?.enabled;
  const daysBefore = body?.daysBefore;

  if (typeof enabled !== "boolean" || typeof daysBefore !== "number") {
    return NextResponse.json(
      { error: "enabled (boolean) and daysBefore (number) are required." },
      { status: 400 }
    );
  }

  if (!ALLOWED_DAYS.has(daysBefore)) {
    return NextResponse.json(
      { error: "daysBefore must be one of: 1, 3, 7, 14, 30" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error } = await admin
    .from("onboarding_profiles")
    .update({
      task_reminders_enabled: enabled,
      task_reminder_days_before: daysBefore,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

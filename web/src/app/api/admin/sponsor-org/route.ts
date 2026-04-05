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

  const body = (await request.json()) as {
    orgId?: string;
    isSponsored?: boolean;
    reason?: string;
  };
  const { orgId, isSponsored, reason } = body;

  if (!orgId || typeof isSponsored !== "boolean") {
    return NextResponse.json({ error: "orgId and isSponsored are required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      is_sponsored: isSponsored,
      sponsored_reason: isSponsored ? (reason ?? null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

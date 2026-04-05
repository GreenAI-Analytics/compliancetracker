import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { taskRef?: string } | null;
  const taskRef = body?.taskRef?.trim();

  if (!taskRef) {
    return NextResponse.json({ error: "taskRef is required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Organization profile not found" }, { status: 404 });
  }

  const { error: deleteError } = await admin
    .from("hidden_items")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("item_type", "task")
    .eq("item_ref", taskRef);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

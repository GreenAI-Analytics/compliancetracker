import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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
    | { categoryRef?: string; enabled?: boolean }
    | null;

  const categoryRef = body?.categoryRef?.trim();
  const enabled = body?.enabled;

  if (!categoryRef || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "categoryRef and enabled are required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("organization_id, country, nace")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Organization profile not found" }, { status: 404 });
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
      return NextResponse.json({ error: "Rule not found for organization profile" }, { status: 404 });
    }

    const { data: category, error: categoryError } = await admin
      .from("categories")
      .select("category_id")
      .eq("rule_id", rule.id)
      .eq("category_id", categoryRef)
      .maybeSingle();

    if (categoryError || !category?.category_id) {
      return NextResponse.json({ error: "Invalid category for organization profile" }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.from("hidden_items").upsert(
    {
      organization_id: profile.organization_id,
      hidden_by: user.id,
      item_type: "category",
      item_ref: categoryRef,
    },
    { onConflict: "organization_id,item_type,item_ref" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

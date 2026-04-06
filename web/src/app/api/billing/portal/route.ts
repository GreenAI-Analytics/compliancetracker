import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/stripe";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const stripe = getStripeServerClient();
  if (!admin || !stripe) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Organization profile not found" }, { status: 404 });
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", profile.organization_id)
    .single();

  if (orgError || !org?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found for this organization." }, { status: 400 });
  }

  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "http://localhost:3000";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appBaseUrl}/billing`,
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create Stripe portal session",
      },
      { status: 500 }
    );
  }
}

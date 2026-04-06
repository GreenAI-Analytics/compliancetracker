import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { euroToCents, getStripeServerClient } from "@/lib/stripe";

const PRICE_KEY = "billing_monthly_price_eur";
const LEGACY_PRICE_KEY = "billing_monthly_price_usd";
const DEFAULT_PRICE = "9.99";

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
    .select("organization_id, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Organization profile not found" }, { status: 404 });
  }

  const [orgRes, settingsRes] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, is_sponsored, billing_email, stripe_customer_id")
      .eq("id", profile.organization_id)
      .single(),
    admin.from("admin_settings").select("key, value").in("key", [PRICE_KEY, LEGACY_PRICE_KEY]),
  ]);

  if (orgRes.error || !orgRes.data) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (orgRes.data.is_sponsored) {
    return NextResponse.json({ error: "Sponsored accounts do not require billing." }, { status: 400 });
  }

  const settings = settingsRes.data ?? [];
  const settingMap = new Map(settings.map((row) => [row.key, row.value]));
  const priceValue = settingMap.get(PRICE_KEY) ?? settingMap.get(LEGACY_PRICE_KEY) ?? DEFAULT_PRICE;
  const unitAmount = euroToCents(priceValue);

  if (!unitAmount) {
    return NextResponse.json({ error: "Invalid billing price configuration." }, { status: 500 });
  }

  let stripeCustomerId = orgRes.data.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: orgRes.data.name,
      email: orgRes.data.billing_email ?? user.email ?? undefined,
      metadata: {
        organizationId: orgRes.data.id,
      },
    });
    stripeCustomerId = customer.id;

    const { error: customerUpdateError } = await admin
      .from("organizations")
      .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
      .eq("id", orgRes.data.id);

    if (customerUpdateError) {
      return NextResponse.json({ error: customerUpdateError.message }, { status: 500 });
    }
  }

  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "http://localhost:3000";

  let subscriptionData;
  if (profile.trial_ends_at) {
    const trialEndSeconds = Math.floor(new Date(profile.trial_ends_at).getTime() / 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (trialEndSeconds > nowSeconds + 60) {
      subscriptionData = { trial_end: trialEndSeconds };
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: {
              name: "Compliance Tracker",
              description: "Monthly compliance monitoring subscription",
            },
          },
        },
      ],
      subscription_data: subscriptionData,
      success_url: `${appBaseUrl}/billing?checkout=success`,
      cancel_url: `${appBaseUrl}/billing?checkout=cancelled`,
      metadata: {
        organizationId: orgRes.data.id,
        userId: user.id,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Unable to create Stripe checkout session." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start Stripe checkout",
      },
      { status: 500 }
    );
  }
}

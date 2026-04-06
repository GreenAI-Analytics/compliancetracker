import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { euroToCents, getStripeServerClient } from "@/lib/stripe";

type Body = {
  email?: string;
  amount?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripeServerClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const allowLivePaymentTest = process.env.ALLOW_LIVE_PAYMENT_TEST === "true";
  if (stripeKey.startsWith("sk_live_") && !allowLivePaymentTest) {
    return NextResponse.json(
      {
        error:
          "Payment test endpoint is disabled for live Stripe keys. Use a test key or set ALLOW_LIVE_PAYMENT_TEST=true intentionally.",
      },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const amount = body?.amount?.trim() ?? "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const amountCents = euroToCents(amount);
  if (!amountCents || amountCents < 50 || amountCents > 1_000_000_00) {
    return NextResponse.json(
      { error: "Amount must be a valid EUR value between 0.50 and 1,000,000.00." },
      { status: 400 }
    );
  }

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ??
    request.nextUrl.origin.replace(/\/$/, "");

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: `${appBaseUrl}/admin?payment_test=success`,
      cancel_url: `${appBaseUrl}/admin?payment_test=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: "Compliance Tracker Test Payment",
              description: "Admin-initiated Stripe payment test",
            },
          },
        },
      ],
      metadata: {
        type: "admin_payment_test",
        admin_email: session.email,
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Stripe checkout URL is missing." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create Stripe test checkout.",
      },
      { status: 500 }
    );
  }
}

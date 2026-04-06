import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/stripe";

function toIsoDate(seconds: number | null | undefined) {
  if (!seconds) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

async function syncSubscriptionByCustomer(
  customerId: string,
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: number | null;
  }
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin client unavailable");
  }

  const { error } = await admin
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_current_period_end: toIsoDate(subscription.currentPeriodEnd),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncCheckoutCompletion(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const organizationId = session.metadata?.organizationId ?? null;

  const admin = getSupabaseAdminClient();
  const stripe = getStripeServerClient();
  if (!admin || !stripe) {
    throw new Error("Server configuration error");
  }

  if (organizationId && customerId) {
    const { error } = await admin
      .from("organizations")
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (customerId && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd = (subscription as unknown as { current_period_end?: number })
      .current_period_end;

    await syncSubscriptionByCustomer(customerId, {
      id: subscription.id,
      status: subscription.status,
      currentPeriodEnd: typeof currentPeriodEnd === "number" ? currentPeriodEnd : null,
    });
  }
}

export async function POST(request: Request) {
  const stripe = getStripeServerClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook configuration missing." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await syncCheckoutCompletion(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const currentPeriodEnd = (subscription as unknown as { current_period_end?: number })
          .current_period_end;

        await syncSubscriptionByCustomer(customerId, {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: typeof currentPeriodEnd === "number" ? currentPeriodEnd : null,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing error." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

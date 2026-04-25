import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

type Body = {
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  vatNumber?: string | null;
  purchaseOrderRef?: string | null;
  paymentMethod?: string | null;
};

const ALLOWED_PAYMENT_METHODS = new Set([
  "card",
  "bank_transfer",
  "invoice",
  "other",
]);

function normalizeOptional(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
    setCsrfCookie(response);
    return response;
  }

  // CSRF validation
  const csrf = validateCsrfToken(request);
  if (!csrf.valid) {
    const response = NextResponse.json({ error: csrf.error }, { status: 403 });
    setCsrfCookie(response);
    return response;
  }

  // Rate limiting
  const rateCheck = rateLimitMiddleware(user.id);
  if (!rateCheck.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
    return response;
  }

  const parsed = await parseBody<Body>(request);
  if (parsed.error) {
    const response = NextResponse.json(
      { error: parsed.error },
      { status: parsed.status ?? 400 },
    );
    setCsrfCookie(response);
    return response;
  }
  const body = parsed.data!;

  const billingContactName = normalizeOptional(body.billingContactName, 255);
  const billingEmail = normalizeOptional(body.billingEmail, 255);
  const billingAddress = normalizeOptional(body.billingAddress, 2000);
  const vatNumber = normalizeOptional(body.vatNumber, 100);
  const purchaseOrderRef = normalizeOptional(body.purchaseOrderRef, 100);
  const paymentMethod = normalizeOptional(body.paymentMethod, 50);

  if (billingEmail && !isValidEmail(billingEmail)) {
    const response = NextResponse.json(
      { error: "Please enter a valid billing email address." },
      { status: 400 },
    );
    setCsrfCookie(response);
    return response;
  }

  if (paymentMethod && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    const response = NextResponse.json(
      {
        error:
          "paymentMethod must be one of: card, bank_transfer, invoice, other",
      },
      { status: 400 },
    );
    setCsrfCookie(response);
    return response;
  }

  // TODO: Switch to server client (createSupabaseServerClient) after RLS policies are in place
  const admin = getSupabaseAdminClient();
  if (!admin) {
    const response = NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
    setCsrfCookie(response);
    return response;
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    console.error("Payment information: organization profile lookup failed", {
      userId: user.id,
      error: profileError?.message,
    });
    const response = NextResponse.json(
      { error: "Organization profile not found" },
      { status: 404 },
    );
    setCsrfCookie(response);
    return response;
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update({
      billing_contact_name: billingContactName,
      billing_email: billingEmail,
      billing_address: billingAddress,
      vat_number: vatNumber,
      purchase_order_ref: purchaseOrderRef,
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.organization_id);

  if (updateError) {
    console.error("Payment information: organization update failed", {
      organizationId: profile.organization_id,
      error: updateError.message,
    });
    const response = NextResponse.json(
      { error: "Database error" },
      { status: 500 },
    );
    setCsrfCookie(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

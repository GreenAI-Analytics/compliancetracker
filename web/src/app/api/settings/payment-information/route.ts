import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Body = {
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  vatNumber?: string | null;
  purchaseOrderRef?: string | null;
  paymentMethod?: string | null;
};

const ALLOWED_PAYMENT_METHODS = new Set(["card", "bank_transfer", "invoice", "other"]);

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const billingContactName = normalizeOptional(body.billingContactName, 255);
  const billingEmail = normalizeOptional(body.billingEmail, 255);
  const billingAddress = normalizeOptional(body.billingAddress, 2000);
  const vatNumber = normalizeOptional(body.vatNumber, 100);
  const purchaseOrderRef = normalizeOptional(body.purchaseOrderRef, 100);
  const paymentMethod = normalizeOptional(body.paymentMethod, 50);

  if (billingEmail && !isValidEmail(billingEmail)) {
    return NextResponse.json({ error: "Please enter a valid billing email address." }, { status: 400 });
  }

  if (paymentMethod && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json(
      { error: "paymentMethod must be one of: card, bank_transfer, invoice, other" },
      { status: 400 }
    );
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
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

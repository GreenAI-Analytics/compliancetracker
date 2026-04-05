import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PaymentInformationForm } from "@/components/payment-information-form";
import { redirect } from "next/navigation";

const PRICE_KEY = "billing_monthly_price_eur";
const LEGACY_PRICE_KEY = "billing_monthly_price_usd";
const DEFAULT_PRICE_EUR = "9.99";

function formatEuro(value: string): string {
  const amount = parseFloat(value);
  if (Number.isNaN(amount)) return `EUR ${DEFAULT_PRICE_EUR}`;

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = getSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("onboarding_profiles")
    .select("signup_date, trial_ends_at, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = profileRes.data;

  const [priceRes, orgRes] = await Promise.all([
    (adminSupabase ?? supabase)
      .from("admin_settings")
      .select("key, value")
      .in("key", [PRICE_KEY, LEGACY_PRICE_KEY]),
    profile?.organization_id
      ? (adminSupabase ?? supabase)
          .from("organizations")
        .select("name, is_sponsored, sponsored_reason, billing_contact_name, billing_email, billing_address, vat_number, purchase_order_ref, payment_method")
          .eq("id", profile.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const settings = priceRes.data ?? [];

  const settingMap = new Map(settings.map((row) => [row.key, row.value]));
  const monthlyPrice =
    settingMap.get(PRICE_KEY) ?? settingMap.get(LEGACY_PRICE_KEY) ?? DEFAULT_PRICE_EUR;

  const org = orgRes.data as
    | {
        name?: string;
        is_sponsored?: boolean;
        sponsored_reason?: string | null;
        billing_contact_name?: string | null;
        billing_email?: string | null;
        billing_address?: string | null;
        vat_number?: string | null;
        purchase_order_ref?: string | null;
        payment_method?: "card" | "bank_transfer" | "invoice" | "other" | null;
      }
    | null;
  const isSponsored = Boolean(org?.is_sponsored);

  const signupDate = profile?.signup_date ? new Date(profile.signup_date) : null;
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const trialExpired = trialDaysLeft === 0;

  return (
    <div>
      <h1 className="text-3xl font-bold">Subscription & Billing</h1>
      <p className="mt-2 text-[#5a675e]">Your billing status, pricing, and trial details.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#d7e5da] bg-white p-4 text-sm text-[#57645c]">
          <p className="font-medium text-[#243229]">Plan</p>
          {isSponsored ? (
            <>
              <p className="mt-2 text-base font-semibold text-[#2e7d32]">Sponsored account</p>
              <p className="mt-1">
                Your organisation is sponsored and is not billed monthly at this time.
              </p>
              {org?.sponsored_reason && (
                <p className="mt-1 text-xs text-[#5f7668]">Reason: {org.sponsored_reason}</p>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-base font-semibold text-[#1f3428]">
                {formatEuro(monthlyPrice)} / month
              </p>
              <p className="mt-1 text-xs text-[#5f7668]">Global price set by your administrator.</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#d7e5da] bg-white p-4 text-sm text-[#57645c]">
          {isSponsored ? (
            <>
              <p className="font-medium text-[#243229]">Billing Status</p>
              <p className="mt-2 text-base font-semibold text-[#2e7d32]">Sponsored</p>
              <p className="mt-1">Trial and recurring billing are disabled for this account.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-[#243229]">Trial</p>
              <p className="mt-1">
                Signup date: {signupDate ? signupDate.toLocaleDateString("en-IE") : "Not available"}
              </p>
              <p>
                Trial ends: {trialEndsAt ? trialEndsAt.toLocaleDateString("en-IE") : "Not available"}
              </p>
              {trialDaysLeft !== null && (
                <p className={`mt-2 font-medium ${trialExpired ? "text-[#9f4b2a]" : "text-[#2e7d32]"}`}>
                  {trialExpired
                    ? "Trial expired"
                    : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`}
                </p>
              )}
              {trialDaysLeft !== null && !trialExpired && (
                <p className="mt-2 text-xs text-[#5f7668]">
                  After trial: {formatEuro(monthlyPrice)} per month
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Payment Information</h2>
        <p className="mt-1 text-sm text-[#5f7668]">
          Manage the billing contact details used for invoices and payment follow-up.
        </p>
        <PaymentInformationForm
          initialValue={{
            billingContactName: org?.billing_contact_name ?? "",
            billingEmail: org?.billing_email ?? user.email ?? "",
            billingAddress: org?.billing_address ?? "",
            vatNumber: org?.vat_number ?? "",
            purchaseOrderRef: org?.purchase_order_ref ?? "",
            paymentMethod: org?.payment_method ?? "card",
          }}
          disabled={!profile?.organization_id}
        />
      </section>
    </div>
  );
}

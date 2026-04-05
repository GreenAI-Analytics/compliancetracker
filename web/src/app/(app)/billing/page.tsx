import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("onboarding_profiles")
    .select("signup_date, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const signupDate = profile?.signup_date ? new Date(profile.signup_date) : null;
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const trialExpired = trialDaysLeft === 0;

  return (
    <div>
      <h1 className="text-3xl font-bold">Subscription & Billing</h1>
      <p className="mt-2 text-[#5a675e]">Full Stripe integration is in V1 scope.</p>

      <div className="mt-5 rounded-xl border border-[#d7e5da] bg-white p-4 text-sm text-[#57645c]">
        <p className="font-medium text-[#243229]">30-day free trial</p>
        <p className="mt-1">
          Signup date: {signupDate ? signupDate.toLocaleDateString("en-IE") : "Not available"}
        </p>
        <p>
          Trial ends: {trialEndsAt ? trialEndsAt.toLocaleDateString("en-IE") : "Not available"}
        </p>
        {trialDaysLeft !== null && (
          <p className={`mt-2 font-medium ${trialExpired ? "text-[#9f4b2a]" : "text-[#2e7d32]"}`}>
            {trialExpired ? "Trial expired" : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`}
          </p>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-[#d6cfb9] bg-[#fffef9] p-4 text-sm text-[#57645c]">
        Build next: Stripe customer portal, checkout, and sponsored-account handling.
      </div>
    </div>
  );
}

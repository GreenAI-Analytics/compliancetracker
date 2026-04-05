import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type ProfileRecord = {
  company_name: string;
  business_address: string | null;
  incorporation_date: string | null;
  country: string;
  nace: string;
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("onboarding_profiles")
    .select("company_name, business_address, incorporation_date, country, nace")
    .eq("user_id", user.id)
    .single();

  const companyProfile = profile as ProfileRecord | null;

  return (
    <div>
      <h1 className="text-3xl font-bold">Profile & Settings</h1>
      <p className="mt-2 text-[#5a675e]">
        Profile, organisation settings, and notification preferences.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-lg font-semibold text-[#1a2e22]">Profile</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[#7a8880]">Email</dt>
              <dd className="mt-1 font-medium text-[#243229]">{user.email ?? "Not available"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-lg font-semibold text-[#1a2e22]">Company Information</h2>

          {companyProfile ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#7a8880]">Company name</dt>
                <dd className="mt-1 font-medium text-[#243229]">{companyProfile.company_name}</dd>
              </div>
              <div>
                <dt className="text-[#7a8880]">Incorporation date</dt>
                <dd className="mt-1 font-medium text-[#243229]">
                  {formatDate(companyProfile.incorporation_date)}
                </dd>
              </div>
              <div>
                <dt className="text-[#7a8880]">Country</dt>
                <dd className="mt-1 font-medium text-[#243229]">{companyProfile.country}</dd>
              </div>
              <div>
                <dt className="text-[#7a8880]">NACE code</dt>
                <dd className="mt-1 font-medium text-[#243229]">{companyProfile.nace}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#7a8880]">Business address</dt>
                <dd className="mt-1 font-medium text-[#243229]">
                  {companyProfile.business_address?.trim() || "Not provided"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[#7b8880]">
              Company information has not been set up for this account yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "Not provided";

  return new Date(dateValue).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

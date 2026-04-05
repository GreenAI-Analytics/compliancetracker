import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SettingsCategoryToggles } from "@/components/settings-category-toggles";
import { CustomTaskManager } from "@/components/custom-task-manager";
import { HiddenTasksManager } from "@/components/hidden-tasks-manager";
import { redirect } from "next/navigation";

type ProfileRecord = {
  company_name: string;
  business_address: string | null;
  incorporation_date: string | null;
  country: string;
  nace: string;
  organization_id: string;
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = getSupabaseAdminClient();
  const queryClient = supabaseAdmin ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await queryClient
    .from("onboarding_profiles")
    .select("company_name, business_address, incorporation_date, country, nace, organization_id")
    .eq("user_id", user.id)
    .single();

  const companyProfile = profile as ProfileRecord | null;

  let categoryToggleItems: Array<{ ref: string; name: string; enabled: boolean }> = [];
  let hiddenTaskItems: Array<{ ref: string; title: string }> = [];

  if (companyProfile?.organization_id) {
    const { data: hiddenCategories } = await queryClient
      .from("hidden_items")
      .select("item_ref")
      .eq("organization_id", companyProfile.organization_id)
      .eq("item_type", "category");

    const hiddenSet = new Set<string>((hiddenCategories ?? []).map((h: { item_ref: string }) => h.item_ref));

    const { data: rule } = await queryClient
      .from("rules")
      .select("id")
      .eq("country", companyProfile.country)
      .eq("nace", companyProfile.nace)
      .maybeSingle();

    if (rule?.id) {
      const { data: categories } = await queryClient
        .from("categories")
        .select("category_id, name, display_order")
        .eq("rule_id", rule.id)
        .order("display_order", { ascending: true });

      categoryToggleItems = (categories ?? []).map(
        (cat: { category_id: string; name: string }) => ({
          ref: cat.category_id,
          name: cat.name,
          enabled: !hiddenSet.has(cat.category_id),
        })
      );
    }

    // Load hidden tasks and resolve their titles from the tasks table
    const { data: hiddenTaskRows } = await queryClient
      .from("hidden_items")
      .select("item_ref")
      .eq("organization_id", companyProfile.organization_id)
      .eq("item_type", "task");

    const hiddenRefs = (hiddenTaskRows ?? []).map((h: { item_ref: string }) => h.item_ref);

    if (hiddenRefs.length > 0) {
      const { data: taskRows } = await queryClient
        .from("tasks")
        .select("task_id, title_key")
        .in("task_id", hiddenRefs);

      const titleMap = Object.fromEntries(
        (taskRows ?? []).map((t: { task_id: string; title_key: string }) => [t.task_id, t.title_key])
      );

      hiddenTaskItems = hiddenRefs.map((ref) => ({
        ref,
        title: formatTitleKey(titleMap[ref] ?? ref),
      }));
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Profile & Settings</h1>
      <p className="mt-2 text-[#5a675e]">
        Profile, organisation settings, and notification preferences.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#1a2e22]">Profile</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[#7a8880]">Email</dt>
              <dd className="mt-1 font-medium text-[#243229]">{user.email ?? "Not available"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
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

      <section className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Category Visibility</h2>
        <p className="mt-1 text-sm text-[#5f7668]">
          Turn categories on or off for your dashboard and historical views.
        </p>
        <SettingsCategoryToggles initialItems={categoryToggleItems} />
      </section>

      <section className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Private Tasks</h2>
        <p className="mt-1 text-sm text-[#5f7668]">
          Add organization-specific tasks with a due date and recurring flag.
        </p>
        <CustomTaskManager
          disabled={!companyProfile?.organization_id}
        />
      </section>

      <section className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#1a2e22]">Hidden Tasks</h2>
        <p className="mt-1 text-sm text-[#5f7668]">
          Tasks you have hidden from your dashboard. Unhide them to restore them to the task list.
        </p>
        <HiddenTasksManager initialItems={hiddenTaskItems} />
      </section>
    </div>
  );
}

function formatTitleKey(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  const prev = parts.length > 1 ? parts[parts.length - 2] : last;
  const slug = last === "title" ? prev : last;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "Not provided";

  return new Date(dateValue).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const queryClient = admin ?? supabase;

  let billingHidden = false;
  if (queryClient) {
    const { data } = await queryClient
      .from("admin_settings")
      .select("value")
      .eq("key", "billing_hidden")
      .maybeSingle();
    billingHidden = data?.value === "true";
  }

  return <AppShell billingHidden={billingHidden}>{children}</AppShell>;
}

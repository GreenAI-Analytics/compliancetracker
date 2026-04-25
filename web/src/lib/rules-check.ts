import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether compliance rules exist for a given country and NACE code.
 *
 * Returns `{ available, ruleCount }` where `available` is `true` when
 * at least one rule row matches, and `ruleCount` is the total number of
 * matched rules.
 */
export async function checkRulesAvailable(
  supabase: SupabaseClient,
  country: string,
  nace: string
): Promise<{ available: boolean; ruleCount: number }> {
  const { count, error } = await supabase
    .from("rules")
    .select("*", { count: "exact", head: true })
    .eq("country", country)
    .eq("nace", nace);

  if (error) {
    console.error("rules-check error:", error.message);
    return { available: false, ruleCount: 0 };
  }

  const available = (count ?? 0) > 0;
  return { available, ruleCount: count ?? 0 };
}

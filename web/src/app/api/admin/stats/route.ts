import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, activeRes, expiredRes, recentRes, byCountryRes, articlesRes] =
    await Promise.all([
      supabase.from("onboarding_profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("onboarding_profiles")
        .select("id", { count: "exact", head: true })
        .gt("trial_ends_at", now),
      supabase
        .from("onboarding_profiles")
        .select("id", { count: "exact", head: true })
        .lte("trial_ends_at", now),
      supabase
        .from("onboarding_profiles")
        .select("id", { count: "exact", head: true })
        .gte("signup_date", thirtyDaysAgo),
      supabase.from("onboarding_profiles").select("country"),
      supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

  // Count by country
  const countryMap: Record<string, number> = {};
  for (const row of byCountryRes.data ?? []) {
    const c = row.country as string;
    countryMap[c] = (countryMap[c] ?? 0) + 1;
  }
  const byCountry = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }));

  return NextResponse.json({
    totalOrgs: totalRes.count ?? 0,
    activeTrials: activeRes.count ?? 0,
    expiredTrials: expiredRes.count ?? 0,
    signupsLast30Days: recentRes.count ?? 0,
    byCountry,
    activeArticles: articlesRes.count ?? 0,
  });
}

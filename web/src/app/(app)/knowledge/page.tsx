import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KnowledgeHubClient from "@/components/knowledge-client";
import type { KnowledgeArticle } from "@/components/knowledge-client";

export default async function KnowledgeHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("onboarding_profiles")
    .select("country")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileCountryCode = profile?.country?.trim().toUpperCase();
  const hasCountryCode = Boolean(
    profileCountryCode && profileCountryCode.length === 2,
  );

  const baseQuery = supabase
    .from("knowledge_articles")
    .select(
      "id, article_id, title, country, category, tags, last_updated, slug, markdown_body, summary",
    )
    .eq("is_active", true)
    .order("last_updated", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);

  let usedFallback = false;
  let articles: KnowledgeArticle[] = [];
  let error: string | null = null;

  if (hasCountryCode && profileCountryCode) {
    const { data: countryData, error: countryError } = await baseQuery.eq(
      "country",
      profileCountryCode,
    );
    if (countryError) {
      error = "Could not load knowledge articles.";
      console.error("Knowledge articles fetch error:", countryError);
    } else if ((countryData ?? []).length > 0) {
      articles = (countryData ?? []) as KnowledgeArticle[];
    } else {
      usedFallback = true;
      const { data: allData, error: allError } = await baseQuery;
      if (allError) {
        error = "Could not load knowledge articles.";
        console.error("Knowledge articles fetch error:", allError);
      } else {
        articles = (allData ?? []) as KnowledgeArticle[];
      }
    }
  } else {
    const { data: allData, error: allError } = await baseQuery;
    if (allError) {
      error = "Could not load knowledge articles.";
      console.error("Knowledge articles fetch error:", allError);
    } else {
      articles = (allData ?? []) as KnowledgeArticle[];
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Knowledge Hub</h1>
      <p className="mt-2 text-[#5a675e]">
        {hasCountryCode && profileCountryCode
          ? usedFallback
            ? `No country-specific articles for ${profileCountryCode} yet. Showing all active articles.`
            : `Showing active articles for ${profileCountryCode}.`
          : "Showing active compliance articles from the knowledge database."}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-[#f3d2c5] bg-[#fff2ec] px-4 py-3 text-sm text-[#9f4b2a]">
          {error}
        </div>
      )}

      {!error && articles.length === 0 && (
        <div className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5 text-sm text-[#5f7668]">
          No knowledge articles found for your current profile.
        </div>
      )}

      {!error && articles.length > 0 && (
        <KnowledgeHubClient articles={articles} />
      )}
    </div>
  );
}

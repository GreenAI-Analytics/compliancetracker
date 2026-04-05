import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type KnowledgeArticle = {
  id: string;
  article_id: string;
  title: string;
  country: string;
  category: string;
  tags: string[];
  last_updated: string | null;
  slug: string;
  markdown_body: string;
  summary: string | null;
};

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
  const hasCountryCode = Boolean(profileCountryCode && profileCountryCode.length === 2);

  const baseQuery = supabase
    .from("knowledge_articles")
    .select("id, article_id, title, country, category, tags, last_updated, slug, markdown_body, summary")
    .eq("is_active", true)
    .order("last_updated", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);
  let usedFallback = false;
  let articles: KnowledgeArticle[] = [];
  let error: Error | null = null;

  if (hasCountryCode && profileCountryCode) {
    const { data: countryData, error: countryError } = await baseQuery.eq("country", profileCountryCode);
    if (countryError) {
      error = countryError;
    } else if ((countryData ?? []).length > 0) {
      articles = (countryData ?? []) as KnowledgeArticle[];
    } else {
      usedFallback = true;
      const { data: allData, error: allError } = await baseQuery;
      if (allError) {
        error = allError;
      } else {
        articles = (allData ?? []) as KnowledgeArticle[];
      }
    }
  } else {
    const { data: allData, error: allError } = await baseQuery;
    if (allError) {
      error = allError;
    } else {
      articles = (allData ?? []) as KnowledgeArticle[];
    }
  }

  const groupedByCategory = Object.entries(
    articles.reduce<Record<string, KnowledgeArticle[]>>((acc, article) => {
      const key = article.category || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(article);
      return acc;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));

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
          Could not load knowledge articles: {error.message}
        </div>
      )}

      {!error && articles.length === 0 && (
        <div className="mt-6 rounded-xl border border-[#d7e5da] bg-white p-5 text-sm text-[#5f7668]">
          No knowledge articles found for your current profile.
        </div>
      )}

      {!error && articles.length > 0 && (
        <div className="mt-6 space-y-6">
          {groupedByCategory.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-lg font-semibold text-[#1a2e22]">{category}</h2>
              <div className="space-y-3">
                {items.map((article) => (
                  <Link
                    key={article.id}
                    href={`/knowledge/${encodeURIComponent(article.article_id)}`}
                    className="block rounded-xl border border-[#d7e5da] bg-white p-4 transition hover:border-[#b9d2bf] hover:bg-[#f9fcfa]"
                  >
                    <article>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#173224]">{article.title}</h3>
                        <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                          {article.country}
                        </span>
                        {article.last_updated && (
                          <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                            Updated {formatDate(article.last_updated)}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-[#43584b]">
                        {article.summary?.trim() || excerptFromMarkdown(article.markdown_body)}
                      </p>

                      {article.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {article.tags.map((tag) => (
                            <span
                              key={`${article.id}-${tag}`}
                              className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function excerptFromMarkdown(markdown: string): string {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return plain.length > 220 ? `${plain.slice(0, 220)}...` : plain;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type KnowledgeArticle = {
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

type Props = {
  articles: KnowledgeArticle[];
};

export default function KnowledgeHubClient({ articles }: Props) {
  // ── Derive unique categories sorted A–Z ────────────────────────────
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) {
      set.add(a.category || "General");
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  // ── State: selected category (null = "All") ────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Filter articles by selected category ───────────────────────────
  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return articles;
    return articles.filter((a) => (a.category || "General") === selectedCategory);
  }, [articles, selectedCategory]);

  // ── Group filtered articles by category for display ────────────────
  const grouped = useMemo(() => {
    return Object.entries(
      filteredArticles.reduce<Record<string, KnowledgeArticle[]>>((acc, article) => {
        const key = article.category || "General";
        if (!acc[key]) acc[key] = [];
        acc[key].push(article);
        return acc;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredArticles]);

  return (
    <>
      {/* ── Category filter chips ─────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            selectedCategory === null
              ? "border-[#1e3326] bg-[#1e3326] text-white"
              : "border-[#d7e5da] bg-white text-[#355143] hover:border-[#b9d2bf] hover:bg-[#f3f8f4]"
          }`}
        >
          All
        </button>

        {uniqueCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selectedCategory === category
                ? "border-[#1e3326] bg-[#1e3326] text-white"
                : "border-[#d7e5da] bg-white text-[#355143] hover:border-[#b9d2bf] hover:bg-[#f3f8f4]"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* ── Results count ─────────────────────────────────────────── */}
      <p className="mt-3 text-xs text-[#7b8880]">
        {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
        {selectedCategory ? ` in “${selectedCategory}”` : " across all categories"}
      </p>

      {/* ── Article list ──────────────────────────────────────────── */}
      <div className="mt-6 space-y-6">
        {grouped.map(([category, items]) => (
          <section key={category}>
            {/* Only show the category heading when viewing "All" */}
            {!selectedCategory && (
              <h2 className="mb-3 text-lg font-semibold text-[#1a2e22]">{category}</h2>
            )}
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

        {filteredArticles.length === 0 && (
          <div className="rounded-xl border border-[#d7e5da] bg-white p-5 text-sm text-[#5f7668]">
            No articles found for category “{selectedCategory}”.
          </div>
        )}
      </div>
    </>
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

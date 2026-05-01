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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Derive unique categories sorted A-Z
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) {
      set.add(a.category || "General");
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  // Normalised search terms
  const searchTerms = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return [];
    return raw
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }, [searchQuery]);

  // Filter articles by category + search query
  const filteredArticles = useMemo(() => {
    let result = articles;

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (a) => (a.category || "General") === selectedCategory,
      );
    }

    // Search filter - checks title, summary, markdown body, and tags
    if (searchTerms.length > 0) {
      result = result.filter((a) => {
        const haystack = [a.title, a.summary ?? "", a.markdown_body, ...a.tags]
          .join(" ")
          .toLowerCase();
        return searchTerms.every((term) => haystack.includes(term));
      });
    }

    return result;
  }, [articles, selectedCategory, searchTerms]);

  // Group filtered articles by category for display
  const grouped = useMemo(() => {
    return Object.entries(
      filteredArticles.reduce<Record<string, KnowledgeArticle[]>>(
        (acc, article) => {
          const key = article.category || "General";
          if (!acc[key]) acc[key] = [];
          acc[key].push(article);
          return acc;
        },
        {},
      ),
    ).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredArticles]);

  // Build a descriptive results label
  const resultsLabel = useMemo(() => {
    const parts: string[] = [];
    if (searchTerms.length > 0) {
      parts.push(`matching "${searchQuery.trim()}"`);
    }
    if (selectedCategory) {
      parts.push(`in "${selectedCategory}"`);
    } else {
      parts.push("across all categories");
    }
    const count = filteredArticles.length;
    return `${count} article${count !== 1 ? "s" : ""} ${parts.join(" ")}`;
  }, [filteredArticles.length, searchTerms, searchQuery, selectedCategory]);

  return (
    <>
      {/* Search bar */}
      <div className="mt-4">
        <div className="relative max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa69c]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full rounded-lg border border-[#d7e5da] bg-white py-2 pl-9 pr-8 text-sm text-[#1a2e22] placeholder-[#9aa69c] transition focus:border-[#b9d2bf] focus:outline-none focus:ring-2 focus:ring-[#b9d2bf]/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#9aa69c] hover:text-[#5a675e]"
              aria-label="Clear search"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
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

      {/* Results count */}
      <p className="mt-3 text-xs text-[#7b8880]">{resultsLabel}</p>

      {/* Article list */}
      <div className="mt-6 space-y-6">
        {grouped.map(([category, items]) => (
          <section key={category}>
            {!selectedCategory && (
              <h2 className="mb-3 text-lg font-semibold text-[#1a2e22]">
                {category}
              </h2>
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
                      <h3 className="text-base font-semibold text-[#173224]">
                        {highlightMatches(article.title, searchTerms)}
                      </h3>
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
                      {article.summary?.trim() ||
                        excerptFromMarkdown(article.markdown_body)}
                    </p>

                    {article.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {article.tags.map((tag) => (
                          <span
                            key={`${article.id}-${tag}`}
                            className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]"
                          >
                            {highlightMatches(tag, searchTerms)}
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
            {searchTerms.length > 0
              ? `No articles matching "${searchQuery.trim()}"${selectedCategory ? ` in "${selectedCategory}"` : ""}. Try a different search term.`
              : `No articles found for category "${selectedCategory}".`}
          </div>
        )}
      </div>
    </>
  );
}

// Highlight search matches in text using a non-stateful regex
function highlightMatches(text: string, terms: string[]): React.ReactNode {
  if (terms.length === 0) return text;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const splitPattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(splitPattern);

  if (parts.length === 1) return text;

  // Non-global regex so test() does not carry lastIndex state
  const testPattern = new RegExp(`^(${escaped.join("|")})$`, "i");

  return (
    <>
      {parts.map((part, i) =>
        testPattern.test(part) ? (
          <mark
            key={i}
            className="rounded-sm bg-[#e8f0d5] px-0.5 text-[#1e3326]"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
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

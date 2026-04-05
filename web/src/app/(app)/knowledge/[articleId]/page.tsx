import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type KnowledgeArticle = {
  article_id: string;
  title: string;
  country: string;
  category: string;
  tags: string[];
  last_updated: string | null;
  markdown_body: string;
};

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const decodedId = decodeURIComponent(articleId);

  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("article_id, title, country, category, tags, last_updated, markdown_body")
    .eq("article_id", decodedId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const article = data as KnowledgeArticle;

  return (
    <div>
      <Link
        href="/knowledge"
        className="inline-flex items-center rounded-lg border border-[#d7e5da] bg-white px-3 py-1.5 text-xs font-medium text-[#2e7d32] transition hover:bg-[#edf5ef]"
      >
        Back to Knowledge Hub
      </Link>

      <article className="mt-4 rounded-xl border border-[#d7e5da] bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
            {article.country}
          </span>
          <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
            {article.category}
          </span>
          {article.last_updated && (
            <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
              Updated {formatDate(article.last_updated)}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold text-[#173224]">{article.title}</h1>

        {article.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span
                key={`${article.article_id}-${tag}`}
                className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 text-[#2f4338]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mt-6 text-2xl font-bold text-[#173224]">{children}</h1>,
              h2: ({ children }) => <h2 className="mt-6 text-xl font-semibold text-[#173224]">{children}</h2>,
              h3: ({ children }) => <h3 className="mt-5 text-lg font-semibold text-[#173224]">{children}</h3>,
              p: ({ children }) => <p className="mt-3 text-sm leading-6 text-[#2f4338]">{children}</p>,
              ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#2f4338]">{children}</ul>,
              ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#2f4338]">{children}</ol>,
              li: ({ children }) => <li className="leading-6">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="mt-4 border-l-4 border-[#cfe0d3] bg-[#f7fbf8] px-4 py-2 text-sm italic text-[#3f5a4a]">
                  {children}
                </blockquote>
              ),
              code: ({ className, children }) => {
                const isBlock = Boolean(className && className.includes("language-"));
                if (isBlock) {
                  return (
                    <code className="block overflow-x-auto rounded-lg border border-[#e5eee7] bg-[#fcfefd] p-3 text-xs text-[#2f4338]">
                      {children}
                    </code>
                  );
                }

                return (
                  <code className="rounded bg-[#edf5ef] px-1 py-0.5 text-xs text-[#1f4e33]">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => <pre className="mt-4">{children}</pre>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1f6a33] underline decoration-[#9bc2a2] underline-offset-2 hover:text-[#165527]"
                >
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="mt-4 overflow-x-auto rounded-lg border border-[#e5eee7]">
                  <table className="min-w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border-b border-[#e5eee7] bg-[#f7fbf8] px-3 py-2 text-left font-semibold text-[#284236]">{children}</th>,
              td: ({ children }) => <td className="border-b border-[#eef4ef] px-3 py-2 align-top text-[#2f4338]">{children}</td>,
            }}
          >
            {article.markdown_body}
          </ReactMarkdown>
        </div>
      </article>
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

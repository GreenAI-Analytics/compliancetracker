import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import JSZip from "npm:jszip@3.10.1";
import yaml from "npm:js-yaml@4.1.0";

type ArticleFrontmatter = {
  title?: string;
  country?: string;
  category?: string;
  tags?: string[];
  last_updated?: string;
  id?: string;
};

type ArticleRecord = {
  article_id: string;
  title: string;
  country: string;
  category: string;
  tags: string[];
  last_updated: string | null;
  slug: string;
  source_path: string;
  source_repo: string;
  source_sha: string | null;
  markdown_body: string;
  summary: string | null;
  is_active: boolean;
  updated_at: string;
};

const REPO_OWNER = "greenaianalytics";
const REPO_NAME = "compliance-knowledge";
const REPO_BRANCH = "main";
const KNOWLEDGE_ROOT = "knowledge/";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const githubToken = Deno.env.get("GITHUB_TOKEN") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const stats = {
  totalFiles: 0,
  processedArticles: 0,
  skippedFiles: 0,
  upsertedArticles: 0,
  parseFailures: 0,
  apiFailures: 0,
};

function githubHeaders() {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "compliancetracker-knowledge-sync",
  };

  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  return headers;
}

async function fetchArchive(): Promise<JSZip> {
  const url = `https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/zip/refs/heads/${REPO_BRANCH}`;
  const response = await fetch(url, { headers: githubHeaders() });

  if (!response.ok) {
    stats.apiFailures += 1;
    throw new Error(`Failed to fetch repository archive: ${response.status} ${response.statusText}`);
  }

  const bytes = await response.arrayBuffer();
  return await JSZip.loadAsync(bytes);
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function parseFrontmatter(content: string): { frontmatter: ArticleFrontmatter; body: string } | null {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return null;
  }

  const frontmatterRaw = match[1];
  const body = match[2]?.trim() ?? "";
  const parsed = yaml.load(frontmatterRaw) as ArticleFrontmatter;

  return {
    frontmatter: parsed ?? {},
    body,
  };
}

function summaryFromBody(body: string): string | null {
  const paragraph = body
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .map((x) => x.trim())
    .find((x) => x.length > 0 && !x.startsWith("#") && !x.startsWith("- "));

  if (!paragraph) {
    return null;
  }

  return paragraph.slice(0, 280);
}

function isArticlePath(path: string): boolean {
  if (!path.endsWith(".md")) {
    return false;
  }

  if (!path.startsWith(KNOWLEDGE_ROOT)) {
    return false;
  }

  if (path.endsWith("/index.md") || path === "knowledge/index.md") {
    return false;
  }

  return /^knowledge\/[A-Z]{2}\/.+\.md$/.test(path);
}

async function collectArticlesFromArchive(): Promise<ArticleRecord[]> {
  const zip = await fetchArchive();
  const archivePrefix = `${REPO_NAME}-${REPO_BRANCH}/`;
  const now = new Date().toISOString();
  const rows: ArticleRecord[] = [];

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir || !entryPath.startsWith(archivePrefix)) {
      continue;
    }

    const relativePath = entryPath.slice(archivePrefix.length);

    if (!isArticlePath(relativePath)) {
      stats.skippedFiles += 1;
      continue;
    }

    stats.totalFiles += 1;

    try {
      const raw = stripBom(await entry.async("text"));
      const parsed = parseFrontmatter(raw);

      if (!parsed) {
        stats.parseFailures += 1;
        continue;
      }

      const frontmatter = parsed.frontmatter;
      const body = parsed.body;
      const slug = relativePath.split("/").pop()!.replace(/\.md$/, "");

      if (!frontmatter.id || !frontmatter.title || !frontmatter.country || !frontmatter.category) {
        stats.parseFailures += 1;
        continue;
      }

      const tags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags.map((x) => String(x).trim()).filter((x) => x.length > 0)
        : [];

      rows.push({
        article_id: frontmatter.id,
        title: frontmatter.title,
        country: frontmatter.country.toUpperCase(),
        category: frontmatter.category,
        tags,
        last_updated: frontmatter.last_updated ?? null,
        slug,
        source_path: relativePath,
        source_repo: REPO_NAME,
        source_sha: null,
        markdown_body: body,
        summary: summaryFromBody(body),
        is_active: true,
        updated_at: now,
      });
      stats.processedArticles += 1;
    } catch (_error) {
      stats.parseFailures += 1;
    }
  }

  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function upsertArticles(rows: ArticleRecord[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const batches = chunk(rows, 200);
  for (const batch of batches) {
    const { error } = await supabase
      .from("knowledge_articles")
      .upsert(batch, { onConflict: "article_id" });

    if (error) {
      throw new Error(`Failed to upsert knowledge articles: ${error.message}`);
    }

    stats.upsertedArticles += batch.length;
  }
}

Deno.serve(async () => {
  try {
    const rows = await collectArticlesFromArchive();
    await upsertArticles(rows);

    return new Response(JSON.stringify({ ok: true, stats }, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message, stats }, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import JSZip from "npm:jszip@3.10.1";

type RuleTask = {
  id: string;
  title_key: string;
  summary_key: string;
  law_ref?: string;
  regulator?: string;
  frequency: string;
  rrule?: string;
  due_rule?: string;
  weekend_policy?: string;
  evidence_required?: boolean;
};

type RuleCategory = {
  id: string;
  name: string;
  tasks: RuleTask[];
};

type RuleFile = {
  nace?: string;
  country?: string;
  version?: string;
  categories?: RuleCategory[];
  division?: string;
  tasks?: unknown[];
};

const REPO_OWNER = "greenaianalytics";
const REPO_NAME = "compliance-rules";
const REPO_BRANCH = "main";
const RULES_ROOT = "rules/";

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
  processedFiles: 0,
  skippedStubs: 0,
  rulesUpserted: 0,
  categoriesUpserted: 0,
  tasksUpserted: 0,
  parseFailures: 0,
  apiFailures: 0,
};

function githubHeaders() {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "compliancetracker-sync",
  };

  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  return headers;
}

async function fetchGithubJson<T>(path: string): Promise<T> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${REPO_BRANCH}`;
  const response = await fetch(url, { headers: githubHeaders() });

  if (!response.ok) {
    stats.apiFailures += 1;
    throw new Error(`GitHub API request failed for ${path}: ${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
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

function isStubFile(data: RuleFile): boolean {
  return !data.nace && !data.country && !data.version && !data.categories && !!data.division;
}

function isValidRuleFile(data: RuleFile): data is Required<Pick<RuleFile, "nace" | "country" | "version" | "categories">> & RuleFile {
  return !!data.nace && !!data.country && !!data.version && Array.isArray(data.categories);
}

async function listRuleFilesFromArchive(): Promise<Array<{ path: string; content: string }>> {
  const zip = await fetchArchive();
  const prefix = `${REPO_NAME}-${REPO_BRANCH}/${RULES_ROOT}`;
  const files: Array<{ path: string; content: string }> = [];

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue;
    }

    if (!entryPath.startsWith(prefix) || !entryPath.endsWith(".json")) {
      continue;
    }

    const relativePath = entryPath.slice(`${REPO_NAME}-${REPO_BRANCH}/`.length);
    const name = relativePath.split("/").pop() ?? "";

    if (!name.startsWith("nace_")) {
      continue;
    }

    files.push({
      path: relativePath,
      content: stripBom(await entry.async("text")),
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function upsertRule(data: Required<Pick<RuleFile, "nace" | "country" | "version" | "categories">>): Promise<string> {
  const payload = {
    country: data.country.toUpperCase(),
    nace: data.nace,
    version: data.version,
    updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase
    .from("rules")
    .upsert(payload, { onConflict: "country,nace" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert rule ${payload.country}/${payload.nace}: ${error.message}`);
  }

  stats.rulesUpserted += 1;
  return row.id as string;
}

async function upsertCategories(ruleId: string, categories: RuleCategory[]): Promise<Map<string, string>> {
  const payload = categories.map((category, index) => ({
    rule_id: ruleId,
    category_id: category.id,
    name: category.name,
    display_order: index,
  }));

  const { data, error } = await supabase
    .from("categories")
    .upsert(payload, { onConflict: "rule_id,category_id" })
    .select("id, category_id");

  if (error) {
    throw new Error(`Failed to upsert categories for rule ${ruleId}: ${error.message}`);
  }

  stats.categoriesUpserted += payload.length;

  const categoryMap = new Map<string, string>();
  for (const row of data ?? []) {
    categoryMap.set(row.category_id as string, row.id as string);
  }

  return categoryMap;
}

async function upsertTasks(ruleId: string, categories: RuleCategory[], categoryMap: Map<string, string>): Promise<void> {
  const updatedAt = new Date().toISOString();
  const payload = categories.flatMap((category) => {
    const categoryId = categoryMap.get(category.id);
    if (!categoryId) {
      throw new Error(`Missing category id after upsert for ${category.id}`);
    }

    return category.tasks.map((task) => ({
      rule_id: ruleId,
      category_id: categoryId,
      task_id: task.id,
      title_key: task.title_key,
      summary_key: task.summary_key,
      law_ref: task.law_ref ?? null,
      regulator: task.regulator ?? null,
      frequency: task.frequency,
      rrule: task.rrule ?? null,
      due_rule: task.due_rule ?? null,
      weekend_policy: task.weekend_policy ?? null,
      evidence_required: task.evidence_required ?? false,
      updated_at: updatedAt,
    }));
  });

  if (payload.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .upsert(payload, { onConflict: "rule_id,task_id" });

  if (error) {
    throw new Error(`Failed to upsert tasks for rule ${ruleId}: ${error.message}`);
  }

  stats.tasksUpserted += payload.length;
}

async function processRuleFile(file: { path: string; content: string }): Promise<void> {
  try {
    const data = JSON.parse(file.content) as RuleFile;

    if (isStubFile(data)) {
      stats.skippedStubs += 1;
      return;
    }

    if (!isValidRuleFile(data)) {
      stats.parseFailures += 1;
      console.error(`Invalid rule file structure: ${file.path}`);
      return;
    }

    const ruleId = await upsertRule(data);
    const categoryMap = await upsertCategories(ruleId, data.categories);
    await upsertTasks(ruleId, data.categories, categoryMap);

    stats.processedFiles += 1;
  } catch (error) {
    stats.parseFailures += 1;
    console.error(`Failed processing ${file.path}:`, error instanceof Error ? error.message : String(error));
  }
}

Deno.serve(async (_request) => {
  try {
    const files = await listRuleFilesFromArchive();
    stats.totalFiles = files.length;

    for (const file of files) {
      await processRuleFile(file);
    }

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
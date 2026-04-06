import { createClient } from "npm:@supabase/supabase-js@2.49.4";

type ReminderProfile = {
  user_id: string;
  organization_id: string;
  task_reminder_days_before: number;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type HiddenItemRow = {
  organization_id: string;
  item_type: string;
  item_ref: string;
};

type DeliveryRow = {
  user_id: string;
  task_source: "standard" | "custom";
  source_id: string;
};

type StandardReminderRow = {
  id: string;
  user_id: string;
  organization_id: string;
  due_date: string;
  tasks:
    | {
        task_id: string;
        title_key: string | null;
        categories:
          | {
              category_id: string;
              name: string;
            }
          | Array<{
              category_id: string;
              name: string;
            }>
          | null;
      }
    | null;
};

type CustomReminderRow = {
  id: string;
  created_by: string;
  organization_id: string;
  title: string;
  due_date: string;
};

type ReminderItem = {
  taskSource: "standard" | "custom";
  sourceId: string;
  title: string;
  dueDate: string;
  categoryName?: string;
};

type UserReminderDigest = {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string;
  organizationName: string;
  daysBefore: number;
  dueDate: string;
  items: ReminderItem[];
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const reminderFromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "";
const appBaseUrl = (Deno.env.get("APP_BASE_URL") ?? "").trim().replace(/\/$/, "");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
}

if (!resendApiKey || !reminderFromEmail) {
  throw new Error("Missing RESEND_API_KEY or REMINDER_FROM_EMAIL secret");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const stats = {
  profilesConsidered: 0,
  usersMissingEmail: 0,
  standardTasksMatched: 0,
  customTasksMatched: 0,
  hiddenTasksSkipped: 0,
  alreadyDeliveredSkipped: 0,
  usersWithDueTasks: 0,
  emailsSent: 0,
  sendFailures: 0,
  deliveriesLogged: 0,
};

function formatTaskTitle(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  const prev = parts.length > 1 ? parts[parts.length - 2] : last;
  const slug = last === "title" ? prev : last;

  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDisplayDate(date: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function isoDateDaysFromToday(days: number): string {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days);
  return utcMidnight.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pluralizeDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function asCategory(
  category:
    | {
        category_id: string;
        name: string;
      }
    | Array<{
        category_id: string;
        name: string;
      }>
    | null,
): { category_id: string; name: string } | null {
  if (!category) {
    return null;
  }

  return Array.isArray(category) ? (category[0] ?? null) : category;
}

function buildEmailText(digest: UserReminderDigest): string {
  const greeting = digest.fullName ? `Hi ${digest.fullName},` : "Hi,";
  const intro = `You have ${digest.items.length} compliance task${digest.items.length === 1 ? "" : "s"} due in ${pluralizeDays(digest.daysBefore)}.`;
  const lines = digest.items.map((item) => {
    const category = item.categoryName ? ` [${item.categoryName}]` : "";
    return `- ${item.title}${category} - due ${formatDisplayDate(item.dueDate)}`;
  });

  const footer = appBaseUrl ? `\nOpen your dashboard: ${appBaseUrl}/dashboard` : "";
  return [greeting, "", intro, "", ...lines, footer].join("\n").trim();
}

function buildEmailHtml(digest: UserReminderDigest): string {
  const greeting = digest.fullName ? `Hi ${escapeHtml(digest.fullName)},` : "Hi,";
  const items = digest.items
    .map((item) => {
      const category = item.categoryName
        ? `<div style="color:#5f7668;font-size:12px;">${escapeHtml(item.categoryName)}</div>`
        : "";

      return `
        <li style="margin:0 0 12px;">
          <div style="font-weight:600;color:#173224;">${escapeHtml(item.title)}</div>
          ${category}
          <div style="color:#355143;font-size:13px;">Due ${escapeHtml(formatDisplayDate(item.dueDate))}</div>
        </li>`;
    })
    .join("");

  const dashboardLink = appBaseUrl
    ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(`${appBaseUrl}/dashboard`)}" style="display:inline-block;background:#2e7d32;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Dashboard</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#173224;">
      <h1 style="margin:0 0 16px;font-size:24px;">Upcoming compliance reminders</h1>
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 16px;">You have ${digest.items.length} compliance task${digest.items.length === 1 ? "" : "s"} due in ${pluralizeDays(digest.daysBefore)}.</p>
      <ul style="padding-left:20px;margin:0;">${items}</ul>
      ${dashboardLink}
    </div>`;
}

async function sendDigestEmail(digest: UserReminderDigest): Promise<string | null> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: reminderFromEmail,
      to: [digest.email],
      subject: `Compliance reminder: ${digest.items.length} task${digest.items.length === 1 ? "" : "s"} due in ${pluralizeDays(digest.daysBefore)}`,
      text: buildEmailText(digest),
      html: buildEmailHtml(digest),
    }),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? `Resend request failed with status ${response.status}`);
  }

  return payload?.id ?? null;
}

function buildHiddenLookup(rows: HiddenItemRow[]): {
  hiddenTaskRefs: Set<string>;
  hiddenCategoryRefs: Set<string>;
} {
  const hiddenTaskRefs = new Set<string>();
  const hiddenCategoryRefs = new Set<string>();

  for (const row of rows) {
    const key = `${row.organization_id}:${row.item_ref}`;
    if (row.item_type === "task") {
      hiddenTaskRefs.add(key);
    }
    if (row.item_type === "category") {
      hiddenCategoryRefs.add(key);
    }
  }

  return { hiddenTaskRefs, hiddenCategoryRefs };
}

async function createReminderDigests(): Promise<Map<string, UserReminderDigest>> {
  const { data: profileRows, error: profileError } = await supabase
    .from("onboarding_profiles")
    .select("user_id, organization_id, task_reminder_days_before")
    .eq("task_reminders_enabled", true);

  if (profileError) {
    throw new Error(`Failed to load reminder profiles: ${profileError.message}`);
  }

  const profiles = (profileRows ?? []) as ReminderProfile[];
  stats.profilesConsidered = profiles.length;

  if (profiles.length === 0) {
    return new Map();
  }

  const userIds = [...new Set(profiles.map((profile) => profile.user_id))];
  const organizationIds = [...new Set(profiles.map((profile) => profile.organization_id))];

  const [{ data: userRows, error: userError }, { data: orgRows, error: orgError }, { data: hiddenRows, error: hiddenError }] = await Promise.all([
    supabase.from("users").select("id, email, full_name").in("id", userIds),
    supabase.from("organizations").select("id, name").in("id", organizationIds),
    supabase
      .from("hidden_items")
      .select("organization_id, item_type, item_ref")
      .in("organization_id", organizationIds)
      .in("item_type", ["task", "category"]),
  ]);

  if (userError) {
    throw new Error(`Failed to load users for reminders: ${userError.message}`);
  }

  if (orgError) {
    throw new Error(`Failed to load organizations for reminders: ${orgError.message}`);
  }

  if (hiddenError) {
    throw new Error(`Failed to load hidden items for reminders: ${hiddenError.message}`);
  }

  const userMap = new Map(((userRows ?? []) as UserRow[]).map((row) => [row.id, row]));
  const organizationMap = new Map(((orgRows ?? []) as OrganizationRow[]).map((row) => [row.id, row]));
  const { hiddenTaskRefs, hiddenCategoryRefs } = buildHiddenLookup((hiddenRows ?? []) as HiddenItemRow[]);

  const digests = new Map<string, UserReminderDigest>();
  const groupedProfiles = new Map<number, ReminderProfile[]>();

  for (const profile of profiles) {
    const user = userMap.get(profile.user_id);
    if (!user?.email) {
      stats.usersMissingEmail += 1;
      continue;
    }

    const bucket = groupedProfiles.get(profile.task_reminder_days_before) ?? [];
    bucket.push(profile);
    groupedProfiles.set(profile.task_reminder_days_before, bucket);
  }

  for (const [daysBefore, dayProfiles] of groupedProfiles.entries()) {
    const targetDate = isoDateDaysFromToday(daysBefore);
    const groupUserIds = [...new Set(dayProfiles.map((profile) => profile.user_id))];

    const [{ data: standardRows, error: standardError }, { data: customRows, error: customError }, { data: deliveryRows, error: deliveryError }] = await Promise.all([
      supabase
        .from("user_task_instances")
        .select(
          `id, user_id, organization_id, due_date,
           tasks!inner(task_id, title_key, categories(category_id, name))`,
        )
        .in("user_id", groupUserIds)
        .eq("status", "pending")
        .eq("due_date", targetDate),
      supabase
        .from("custom_tasks")
        .select("id, created_by, organization_id, title, due_date")
        .in("created_by", groupUserIds)
        .eq("status", "pending")
        .eq("due_date", targetDate),
      supabase
        .from("task_reminder_deliveries")
        .select("user_id, task_source, source_id")
        .in("user_id", groupUserIds)
        .eq("days_before", daysBefore)
        .eq("due_date", targetDate),
    ]);

    if (standardError) {
      throw new Error(`Failed to load standard task reminders: ${standardError.message}`);
    }

    if (customError) {
      throw new Error(`Failed to load custom task reminders: ${customError.message}`);
    }

    if (deliveryError) {
      throw new Error(`Failed to load reminder delivery log: ${deliveryError.message}`);
    }

    const deliveredKeys = new Set(
      ((deliveryRows ?? []) as DeliveryRow[]).map((row) => `${row.user_id}:${row.task_source}:${row.source_id}`),
    );

    for (const row of (standardRows ?? []) as StandardReminderRow[]) {
      const task = row.tasks;
      const category = asCategory(task?.categories ?? null);
      const hiddenTaskKey = task?.task_id ? `${row.organization_id}:${task.task_id}` : "";
      const hiddenCategoryKey = category?.category_id ? `${row.organization_id}:${category.category_id}` : "";

      if ((hiddenTaskKey && hiddenTaskRefs.has(hiddenTaskKey)) || (hiddenCategoryKey && hiddenCategoryRefs.has(hiddenCategoryKey))) {
        stats.hiddenTasksSkipped += 1;
        continue;
      }

      const deliveredKey = `${row.user_id}:standard:${row.id}`;
      if (deliveredKeys.has(deliveredKey)) {
        stats.alreadyDeliveredSkipped += 1;
        continue;
      }

      stats.standardTasksMatched += 1;

      const user = userMap.get(row.user_id);
      const organization = organizationMap.get(row.organization_id);
      if (!user?.email || !organization) {
        continue;
      }

      const digest = digests.get(row.user_id) ?? {
        userId: row.user_id,
        email: user.email,
        fullName: user.full_name,
        organizationId: row.organization_id,
        organizationName: organization.name,
        daysBefore,
        dueDate: row.due_date,
        items: [],
      };

      digest.items.push({
        taskSource: "standard",
        sourceId: row.id,
        title: formatTaskTitle(task?.title_key ?? task?.task_id ?? "Task"),
        dueDate: row.due_date,
        categoryName: category?.name,
      });

      digests.set(row.user_id, digest);
    }

    for (const row of (customRows ?? []) as CustomReminderRow[]) {
      const deliveredKey = `${row.created_by}:custom:${row.id}`;
      if (deliveredKeys.has(deliveredKey)) {
        stats.alreadyDeliveredSkipped += 1;
        continue;
      }

      stats.customTasksMatched += 1;

      const user = userMap.get(row.created_by);
      const organization = organizationMap.get(row.organization_id);
      if (!user?.email || !organization) {
        continue;
      }

      const digest = digests.get(row.created_by) ?? {
        userId: row.created_by,
        email: user.email,
        fullName: user.full_name,
        organizationId: row.organization_id,
        organizationName: organization.name,
        daysBefore,
        dueDate: row.due_date,
        items: [],
      };

      digest.items.push({
        taskSource: "custom",
        sourceId: row.id,
        title: row.title,
        dueDate: row.due_date,
      });

      digests.set(row.created_by, digest);
    }
  }

  stats.usersWithDueTasks = [...digests.values()].filter((digest) => digest.items.length > 0).length;
  return digests;
}

async function logDeliveries(digest: UserReminderDigest, resendEmailId: string | null): Promise<void> {
  const payload = digest.items.map((item) => ({
    user_id: digest.userId,
    task_source: item.taskSource,
    source_id: item.sourceId,
    organization_id: digest.organizationId,
    due_date: item.dueDate,
    days_before: digest.daysBefore,
    resend_email_id: resendEmailId,
    sent_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("task_reminder_deliveries")
    .insert(payload);

  if (error) {
    throw new Error(`Failed to log reminder deliveries: ${error.message}`);
  }

  stats.deliveriesLogged += payload.length;
}

Deno.serve(async () => {
  try {
    const digests = await createReminderDigests();
    const dueDigests = [...digests.values()].filter((digest) => digest.items.length > 0);

    if (dueDigests.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        message: "No reminder emails sent because no tasks are due.",
        stats,
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    for (const digest of dueDigests) {
      try {
        const resendEmailId = await sendDigestEmail(digest);
        await logDeliveries(digest, resendEmailId);
        stats.emailsSent += 1;
      } catch (error) {
        stats.sendFailures += 1;
        console.error(
          `Failed sending reminder email to ${digest.email}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
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
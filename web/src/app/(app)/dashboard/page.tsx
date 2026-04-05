import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedUserTasks } from "@/lib/task-seeder";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/task-list";
import { ComplianceCalendar } from "@/components/compliance-calendar";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

type OnboardingProfile = {
  company_name: string;
  country: string;
  nace: string;
  organization_id: string;
};

type CustomTask = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  isRecurring: boolean;
  recurringInterval: string | null;
  priority: string | null;
};

type CustomTaskRecord = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  details: string | null;
};

const INTERVAL_LABEL: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  bimonthly: "Bi-monthly",
  quarterly: "Quarterly",
  semi_annually: "Semi-annually",
  annually: "Annually",
};

function parseDetailsField<T>(details: string | null, key: string): T | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return (parsed[key] as T) ?? null;
  } catch {
    return null;
  }
}

function parseIsRecurring(details: string | null): boolean {
  return parseDetailsField<boolean>(details, "isRecurring") === true;
}

type TaskRow = {
  id: string;
  due_date: string;
  status: string;
  priority: string;
  tasks: {
    id: string;
    task_id: string;
    title_key: string;
    summary_key: string;
    frequency: string;
    law_ref: string | null;
    regulator: string | null;
    rrule: string | null;
    due_rule: string | null;
    weekend_policy: string | null;
    evidence_required: boolean;
    categories: {
      id: string;
      category_id: string;
      name: string;
      display_order: number;
    } | null;
  } | null;
};

type CalendarTask = {
  id: string;
  dueDate: string;
  title: string;
};

async function getDashboardData(userId: string) {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = getSupabaseAdminClient();
  const queryClient = supabaseAdmin ?? supabase;

  const { data: profile } = await queryClient
    .from("onboarding_profiles")
    .select("company_name, country, nace, organization_id")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return {
      profile: null,
      stats: null,
      upcoming: [],
      priorityTasks: [],
      categories: [],
      customTasks: [],
      calendarTasks: [],
    };
  }

  // Get hidden task and category refs for this org
  const hiddenTaskRefs = new Set<string>();
  const hiddenCategoryRefs = new Set<string>();
  if (profile.organization_id) {
    const { data: hiddenRows } = await queryClient
      .from("hidden_items")
      .select("item_ref, item_type")
      .eq("organization_id", profile.organization_id);
    (hiddenRows ?? []).forEach((h: { item_ref: string; item_type: string }) => {
      if (h.item_type === "task") hiddenTaskRefs.add(h.item_ref);
      if (h.item_type === "category") hiddenCategoryRefs.add(h.item_ref);
    });
  }

  let { data: instances } = await queryClient
    .from("user_task_instances")
    .select(
      `id, due_date, status, priority,
       tasks(id, task_id, title_key, summary_key, frequency, law_ref, regulator, rrule, due_rule, weekend_policy, evidence_required,
         categories(id, category_id, name, display_order)
       )`
    )
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  // First-load fallback: ensure task instances exist for the user's country + NACE profile.
  if ((instances?.length ?? 0) === 0 && profile.organization_id) {
    if (supabaseAdmin) {
      await seedUserTasks(
        supabaseAdmin,
        userId,
        profile.organization_id,
        profile.country,
        profile.nace
      );

      const { data: seededInstances } = await queryClient
        .from("user_task_instances")
        .select(
          `id, due_date, status, priority,
           tasks(id, task_id, title_key, summary_key, frequency, law_ref, regulator, rrule, due_rule, weekend_policy, evidence_required,
             categories(id, category_id, name, display_order)
           )`
        )
        .eq("user_id", userId)
        .order("due_date", { ascending: true });

      instances = seededInstances;
    }
  }

  const rows = (instances ?? []) as unknown as TaskRow[];
  const visibleRows = rows.filter((r) => {
    const taskRef = r.tasks?.task_id ?? "";
    const categoryRef = r.tasks?.categories?.category_id ?? "";
    return !hiddenTaskRefs.has(taskRef) && !hiddenCategoryRefs.has(categoryRef);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

  const currentTasks = visibleRows.filter((row) => {
    const due = new Date(row.due_date);
    return row.status !== "completed" && due >= today && due <= endOfYear;
  });

  // Group current/future tasks by category for the Tasks section
  const categoryMap = new Map<string, { name: string; order: number; tasks: TaskRow[] }>();
  for (const row of currentTasks) {
    const cat = row.tasks?.categories;
    const catId = cat?.id ?? "uncategorised";
    const catName = cat?.name ?? "Uncategorised";
    const catOrder = cat?.display_order ?? 999;
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, { name: catName, order: catOrder, tasks: [] });
    }
    categoryMap.get(catId)!.tasks.push(row);
  }
  const categories = [...categoryMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, val]) => ({ id, ...val }));

  const in14Days = new Date(today);
  in14Days.setDate(today.getDate() + 14);
  const in6Months = new Date(today);
  in6Months.setMonth(today.getMonth() + 6);

  const total = visibleRows.length;
  const completed = visibleRows.filter((i) => i.status === "completed").length;
  const overdue = visibleRows.filter(
    (i) => i.status !== "completed" && new Date(i.due_date) < today
  ).length;
  const dueSoon = visibleRows.filter((i) => {
    const d = new Date(i.due_date);
    return i.status !== "completed" && d >= today && d <= in14Days;
  }).length;

  const healthScore = total > 0 ? Math.round((completed / total) * 100) : 0;

  const upcoming = visibleRows
    .filter((i) => {
      const d = new Date(i.due_date);
      return i.status !== "completed" && d >= today && d <= in6Months;
    })
    .slice(0, 8);

  const priorityTasks = visibleRows
    .filter((i) => {
      if (i.status === "completed") return false;
      const d = new Date(i.due_date);
      return d < today || (d >= today && d <= in14Days);
    })
    .slice(0, 4);

  let customTasks: CustomTask[] = [];
  if (profile.organization_id) {
    const { data: customTaskRows } = await queryClient
      .from("custom_tasks")
      .select("id, title, due_date, status, details")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(50);

    customTasks = ((customTaskRows ?? []) as CustomTaskRecord[])
      .map((row) => ({
        id: row.id,
        title: row.title,
        due_date: row.due_date,
        status: row.status,
        isRecurring: parseIsRecurring(row.details),
        recurringInterval: parseDetailsField<string>(row.details, "recurringInterval"),
        priority: parseDetailsField<string>(row.details, "priority"),
      }))
      .filter((task) => {
        if (task.status === "completed") return false;
        if (!task.due_date) return true;
        const due = new Date(task.due_date);
        return due >= today && due <= endOfYear;
      });
  }

  const calendarTasks: CalendarTask[] = visibleRows
    .filter((i) => i.status !== "completed")
    .map((i) => ({
      id: i.id,
      dueDate: i.due_date,
      title: formatTaskTitle(i.tasks?.title_key ?? i.tasks?.task_id ?? "Task"),
    }));

  return {
    profile: profile as OnboardingProfile,
    stats: { total, completed, overdue, dueSoon, healthScore },
    upcoming,
    priorityTasks,
    categories,
    customTasks,
    calendarTasks,
  };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const {
    profile,
    stats,
    upcoming,
    priorityTasks,
    categories,
    customTasks,
    calendarTasks,
  } = await getDashboardData(user.id);

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <h1 className="text-2xl font-bold">Almost there</h1>
        <p className="text-[#5e695f]">
          Your account is set up but company data is still being initialised.
        </p>
        <p className="text-sm text-[#7b8880]">
          If this persists, please contact support.
        </p>
      </div>
    );
  }

  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();

  const quarterLabel = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2", "Q3", "Q3", "Q3", "Q4", "Q4", "Q4"][
    today.getMonth()
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-[#486255]">
            {profile.company_name} &middot; {profile.country} &middot; NACE {profile.nace}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && stats.total > 0 && (
            <div className="rounded-full bg-[#e4f3e7] px-3 py-1 text-xs font-medium text-[#1b5e20]">
              {stats.completed} / {stats.total} complete
            </div>
          )}
          <div className="min-w-[120px] rounded-lg border border-[#d7e5da] bg-white">
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Health Score */}
        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#3e5c4b]">Compliance Health Score</h2>
          <p className="mt-2 text-4xl font-bold text-[var(--accent)]">
            {stats ? `${stats.healthScore}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-[#4f675a]">
            {stats
              ? `${stats.completed} of ${stats.total} tasks completed`
              : "No tasks generated yet"}
          </p>
          {stats && stats.total > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e4efe6]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${stats.healthScore}%` }}
              />
            </div>
          )}
        </section>

        {/* Priority Tasks */}
        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#3e5c4b]">Priority Tasks</h2>
          <p className="mt-2 text-4xl font-bold">
            {stats ? stats.overdue + stats.dueSoon : "—"}
          </p>
          <p className="mt-1 text-sm text-[#4f675a]">
            {stats
              ? `${stats.overdue} overdue · ${stats.dueSoon} due in 14 days`
              : "Loading…"}
          </p>
          {stats && stats.overdue > 0 && (
            <p className="mt-2 text-xs font-medium text-[#b85c38]">
              ⚠ {stats.overdue} task{stats.overdue > 1 ? "s" : ""} past due
            </p>
          )}
          {priorityTasks.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {priorityTasks.map((inst) => (
                <li key={inst.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-[#3b4a3f]">
                    {formatTaskTitle(inst.tasks?.title_key ?? inst.tasks?.task_id ?? "Task")}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-[#7a8880]">
                    {formatDate(inst.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#6b8073]">No overdue or due-soon tasks right now.</p>
          )}
        </section>

        {/* Upcoming Requirements */}
        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#3e5c4b]">Upcoming Requirements</h2>
          <p className="mt-2 text-2xl font-bold">{quarterLabel} highlights</p>
          {upcoming.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {upcoming.slice(0, 4).map((inst) => (
                <li key={inst.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-[#3b4a3f]">
                    {formatTaskTitle(inst.tasks?.title_key ?? inst.tasks?.task_id ?? "Task")}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-[#7a8880]">
                    {formatDate(inst.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#6b8073]">No upcoming deadlines in 6 months.</p>
          )}
        </section>

        {/* Compliance Calendar */}
        <section className="rounded-xl border border-[#d7e5da] bg-white p-5">
          <ComplianceCalendar
            initialYear={year}
            initialMonth={monthIndex}
            tasks={calendarTasks}
          />
        </section>
      </div>

      {/* Tasks */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Tasks</h2>
            <p className="mt-1 text-sm text-[#5f6b62]">
              Showing incomplete tasks due from today until year end.
            </p>
          </div>
          <Link
            href="/historical"
            className="rounded-lg border border-[#d7e5da] bg-white px-3 py-2 text-sm text-[#1e3326] hover:bg-[#edf5ef]"
          >
            View historical data
          </Link>
        </div>
        {categories.length === 0 && customTasks.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#d7e5da] bg-white p-6 text-center text-sm text-[#4f675a]">
            No upcoming tasks from today onward.
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {customTasks.length > 0 && (
              <section>
                <h3 className="mb-3 text-lg font-semibold text-[#1a2e22]">Private Tasks</h3>
                <div className="divide-y divide-[#e5eee7] rounded-xl border border-[#d7e5da] bg-white">
                  {customTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#173224]">{task.title}</p>
                        <p className="mt-0.5 text-xs text-[#5f7668]">
                          {task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {task.priority === "high" && (
                          <span className="rounded-full border border-[#f5b8b0] bg-[#fde8e4] px-2 py-0.5 text-[11px] font-medium text-[#9f3a2a]">High</span>
                        )}
                        {task.priority === "medium" && (
                          <span className="rounded-full border border-[#f5d9a0] bg-[#fff4e0] px-2 py-0.5 text-[11px] font-medium text-[#8a6200]">Medium</span>
                        )}
                        {task.priority === "low" && (
                          <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">Low</span>
                        )}
                        <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                          {task.isRecurring
                            ? (task.recurringInterval ? INTERVAL_LABEL[task.recurringInterval] ?? "Recurring" : "Recurring")
                            : "One-time"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {categories.map((cat) => (
              <section key={cat.id}>
                <h3 className="mb-3 text-lg font-semibold text-[#1a2e22]">{cat.name}</h3>
                <TaskList instanceUserId={user.id} tasks={cat.tasks} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTaskTitle(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  const prev = parts.length > 1 ? parts[parts.length - 2] : last;
  const slug = last === "title" ? prev : last;
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedUserTasks } from "@/lib/task-seeder";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/task-list";

type OnboardingProfile = {
  company_name: string;
  country: string;
  nace: string;
  organization_id: string;
};

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
    categories: {
      id: string;
      name: string;
      display_order: number;
    } | null;
  } | null;
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

  if (!profile) return { profile: null, stats: null, upcoming: [], categories: [] };

  // Get hidden task refs for this org
  const hiddenRefs = new Set<string>();
  if (profile.organization_id) {
    const { data: hiddenRows } = await queryClient
      .from("hidden_items")
      .select("item_ref")
      .eq("organization_id", profile.organization_id)
      .eq("item_type", "task");
    (hiddenRows ?? []).forEach((h: { item_ref: string }) => hiddenRefs.add(h.item_ref));
  }

  let { data: instances } = await queryClient
    .from("user_task_instances")
    .select(
      `id, due_date, status, priority,
       tasks(id, task_id, title_key, summary_key, frequency, law_ref, regulator,
         categories(id, name, display_order)
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
           tasks(id, task_id, title_key, summary_key, frequency, law_ref, regulator,
             categories(id, name, display_order)
           )`
        )
        .eq("user_id", userId)
        .order("due_date", { ascending: true });

      instances = seededInstances;
    }
  }

  const rows = (instances ?? []) as unknown as TaskRow[];
  const visibleRows = rows.filter((r) => !hiddenRefs.has(r.tasks?.task_id ?? ""));

  // Group by category
  const categoryMap = new Map<string, { name: string; order: number; tasks: TaskRow[] }>();
  for (const row of visibleRows) {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

  return {
    profile: profile as OnboardingProfile,
    stats: { total, completed, overdue, dueSoon, healthScore },
    upcoming,
    categories,
  };
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { profile, stats, upcoming, categories } = await getDashboardData(user.id);

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
  const monthName = today.toLocaleString("en-IE", { month: "long" });
  const quarterLabel = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2", "Q3", "Q3", "Q3", "Q4", "Q4", "Q4"][
    today.getMonth()
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-[#5e695f]">
            {profile.company_name} &middot; {profile.country} &middot; NACE {profile.nace}
          </p>
        </div>
        {stats && stats.total > 0 && (
          <div className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs font-medium text-[#1a6b4a]">
            {stats.completed} / {stats.total} complete
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Health Score */}
        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-sm font-semibold text-[#4e5b53]">Compliance Health Score</h2>
          <p className="mt-2 text-4xl font-bold text-[var(--accent)]">
            {stats ? `${stats.healthScore}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-[#5f6b62]">
            {stats
              ? `${stats.completed} of ${stats.total} tasks completed`
              : "No tasks generated yet"}
          </p>
          {stats && stats.total > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e5e1d6]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${stats.healthScore}%` }}
              />
            </div>
          )}
        </section>

        {/* Priority Tasks */}
        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-sm font-semibold text-[#4e5b53]">Priority Tasks</h2>
          <p className="mt-2 text-4xl font-bold">
            {stats ? stats.overdue + stats.dueSoon : "—"}
          </p>
          <p className="mt-1 text-sm text-[#5f6b62]">
            {stats
              ? `${stats.overdue} overdue · ${stats.dueSoon} due in 14 days`
              : "Loading…"}
          </p>
          {stats && stats.overdue > 0 && (
            <p className="mt-2 text-xs font-medium text-[#b85c38]">
              ⚠ {stats.overdue} task{stats.overdue > 1 ? "s" : ""} past due
            </p>
          )}
        </section>

        {/* Upcoming Requirements */}
        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-sm font-semibold text-[#4e5b53]">Upcoming Requirements</h2>
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
            <p className="mt-2 text-sm text-[#7b8880]">No upcoming deadlines in 6 months.</p>
          )}
        </section>

        {/* Compliance Calendar */}
        <section className="rounded-xl border border-[#d6cfbc] bg-[#fffef9] p-5">
          <h2 className="text-sm font-semibold text-[#4e5b53]">Compliance Calendar</h2>
          <p className="mt-2 text-2xl font-bold">{monthName}</p>
          {(() => {
            const thisMonth = upcoming.filter((i) => {
              const d = new Date(i.due_date);
              return (
                d.getMonth() === today.getMonth() &&
                d.getFullYear() === today.getFullYear()
              );
            });
            if (thisMonth.length === 0)
              return <p className="mt-2 text-sm text-[#7b8880]">No deadlines this month.</p>;
            return (
              <ul className="mt-2 space-y-1">
                {thisMonth.slice(0, 4).map((inst) => (
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
            );
          })()}
        </section>
      </div>

      {/* Tasks */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold">Tasks</h2>
        {categories.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#d7cfba] bg-[#fffef9] p-6 text-center text-sm text-[#4f5d54]">
            No tasks found. Make sure your compliance rules are synced and your country/NACE profile is saved.
          </div>
        ) : (
          <div className="mt-4 space-y-6">
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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/task-list";

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

export default async function HistoricalPage() {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = getSupabaseAdminClient();
  const queryClient = supabaseAdmin ?? supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await queryClient
    .from("onboarding_profiles")
    .select("company_name, country, nace, organization_id")
    .eq("user_id", user.id)
    .single();

  const hiddenRefs = new Set<string>();
  if (profile?.organization_id) {
    const { data: hiddenRows } = await queryClient
      .from("hidden_items")
      .select("item_ref")
      .eq("organization_id", profile.organization_id)
      .eq("item_type", "task");
    (hiddenRows ?? []).forEach((h: { item_ref: string }) => hiddenRefs.add(h.item_ref));
  }

  const { data: instances } = await queryClient
    .from("user_task_instances")
    .select(
      `id, due_date, status, priority,
       tasks(id, task_id, title_key, summary_key, frequency, law_ref, regulator,
         categories(id, name, display_order)
       )`
    )
    .eq("user_id", user.id)
    .order("due_date", { ascending: false });

  const rows = (instances ?? []) as unknown as TaskRow[];
  const visibleRows = rows.filter((r) => !hiddenRefs.has(r.tasks?.task_id ?? ""));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historicalRows = visibleRows.filter((row) => {
    const due = new Date(row.due_date);
    return row.status === "completed" || due < today;
  });

  const categoryMap = new Map<string, { name: string; order: number; tasks: TaskRow[] }>();
  for (const row of historicalRows) {
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

  const completed = historicalRows.filter((r) => r.status === "completed").length;
  const overdueOpen = historicalRows.filter(
    (r) => r.status !== "completed" && new Date(r.due_date) < today
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Historical Data</h1>
          <p className="mt-1 text-[#5a675e]">
            Completed tasks and overdue tasks from previous dates.
          </p>
        </div>
        <div className="rounded-full bg-[#edf7f2] px-3 py-1 text-xs font-medium text-[#1a6b4a]">
          {completed} completed · {overdueOpen} overdue open
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[#d7cfba] bg-[#fffef9] p-6 text-center text-sm text-[#4f5d54]">
          No historical tasks yet.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {categories.map((cat) => (
            <section key={cat.id}>
              <h2 className="mb-3 text-lg font-semibold text-[#1a2e22]">{cat.name}</h2>
              <TaskList instanceUserId={user.id} tasks={cat.tasks} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

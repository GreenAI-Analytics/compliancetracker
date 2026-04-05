/**
 * Generates user_task_instances for a user based on their country + NACE code.
 * Called once after signup or on first dashboard load if none exist.
 */

import { SupabaseClient } from "@supabase/supabase-js";

type Task = {
  id: string;
  task_id: string;
  frequency: string;
  due_rule: string | null;
};

type InstanceRow = {
  user_id: string;
  task_id: string;
  organization_id: string;
  instance_number: number;
  cycle_id: string;
  due_date: string;
  status: string;
  priority: string;
};

function buildCycleId(taskId: string, suffix: string): string {
  const compactTaskId = taskId.replace(/-/g, "");
  return `${compactTaskId}_${suffix}`.slice(0, 50);
}

function parseDueMonthDay(dueRule: string | null): { month: number; day: number } {
  if (!dueRule) return { month: 12, day: 31 };
  const parts: Record<string, string> = {};
  dueRule.split(",").forEach((p) => {
    const [k, v] = p.trim().split("=");
    if (k && v) parts[k.trim()] = v.trim();
  });
  return {
    month: parseInt(parts["month"] ?? "12", 10),
    day: parseInt(parts["day"] ?? "31", 10),
  };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0); // day=0 gives last day of previous month
}

export function buildTaskInstances(
  tasks: Task[],
  userId: string,
  organizationId: string,
  today: Date
): InstanceRow[] {
  const toDate = new Date(today.getFullYear() + 1, 11, 31); // Through end of next year
  const rows: InstanceRow[] = [];

  for (const task of tasks) {
    const { frequency, due_rule } = task;

    if (frequency === "continuous") continue; // No specific due date

    if (frequency === "one_time") {
      const { month, day } = parseDueMonthDay(due_rule);
      // Try current year first, then next
      let d = new Date(today.getFullYear(), month - 1, day);
      if (d < today) d = new Date(today.getFullYear() + 1, month - 1, day);
      rows.push({
        user_id: userId,
        task_id: task.id,
        organization_id: organizationId,
        instance_number: 1,
        cycle_id: buildCycleId(task.id, "one_time"),
        due_date: toDateStr(d),
        status: "pending",
        priority: "normal",
      });
      continue;
    }

    if (frequency === "annual") {
      const { month, day } = parseDueMonthDay(due_rule);
      for (let year = today.getFullYear(); year <= toDate.getFullYear(); year++) {
        const d = new Date(year, month - 1, day);
        if (d >= today && d <= toDate) {
          rows.push({
            user_id: userId,
            task_id: task.id,
            organization_id: organizationId,
            instance_number: year - today.getFullYear() + 1,
            cycle_id: buildCycleId(task.id, `annual_${year}`),
            due_date: toDateStr(d),
            status: "pending",
            priority: "normal",
          });
        }
      }
      continue;
    }

    if (frequency === "semiannual") {
      const semiMonths = [6, 12];
      const semiDays = [30, 31];
      let num = 1;
      for (let year = today.getFullYear(); year <= toDate.getFullYear(); year++) {
        for (let i = 0; i < 2; i++) {
          const d = new Date(year, semiMonths[i] - 1, semiDays[i]);
          if (d >= today && d <= toDate) {
            rows.push({
              user_id: userId,
              task_id: task.id,
              organization_id: organizationId,
              instance_number: num++,
              cycle_id: buildCycleId(task.id, `semi_${year}_${i + 1}`),
              due_date: toDateStr(d),
              status: "pending",
              priority: "normal",
            });
          }
        }
      }
      continue;
    }

    if (frequency === "quarterly") {
      const qMonths = [3, 6, 9, 12];
      const qDays = [31, 30, 30, 31];
      let num = 1;
      for (let year = today.getFullYear(); year <= toDate.getFullYear(); year++) {
        for (let i = 0; i < 4; i++) {
          const d = new Date(year, qMonths[i] - 1, qDays[i]);
          if (d >= today && d <= toDate) {
            rows.push({
              user_id: userId,
              task_id: task.id,
              organization_id: organizationId,
              instance_number: num++,
              cycle_id: buildCycleId(task.id, `quarterly_${year}_q${i + 1}`),
              due_date: toDateStr(d),
              status: "pending",
              priority: "normal",
            });
          }
        }
      }
      continue;
    }

    if (frequency === "monthly") {
      let num = 1;
      for (let year = today.getFullYear(); year <= toDate.getFullYear(); year++) {
        const startMonth = year === today.getFullYear() ? today.getMonth() : 0;
        for (let m = startMonth; m < 12; m++) {
          const d = lastDayOfMonth(year, m + 1);
          if (d >= today && d <= toDate) {
            rows.push({
              user_id: userId,
              task_id: task.id,
              organization_id: organizationId,
              instance_number: num++,
              cycle_id: buildCycleId(task.id, `monthly_${year}_${m + 1}`),
              due_date: toDateStr(d),
              status: "pending",
              priority: "normal",
            });
          }
        }
      }
      continue;
    }

    // weekly / custom_rrule — skip for V1
  }

  return rows;
}

export async function seedUserTasks(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  country: string,
  nace: string
): Promise<{ count: number; error: string | null }> {
  // Get rule for this country + nace
  const { data: ruleData, error: ruleErr } = await supabase
    .from("rules")
    .select("id")
    .eq("country", country)
    .eq("nace", nace)
    .single();

  if (ruleErr || !ruleData) {
    return { count: 0, error: `No rules found for ${country}/${nace}` };
  }

  // Get all tasks for this rule
  const { data: tasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, task_id, frequency, due_rule")
    .eq("rule_id", ruleData.id);

  if (tasksErr || !tasks) {
    return { count: 0, error: tasksErr?.message ?? "Failed to load tasks" };
  }

  const today = new Date();
  const rows = buildTaskInstances(tasks as Task[], userId, organizationId, today);

  if (rows.length === 0) {
    return { count: 0, error: null };
  }

  // Upsert (ignore duplicates by cycle_id unique constraint)
  const { error: insertErr } = await supabase
    .from("user_task_instances")
    .upsert(rows, { onConflict: "user_id,task_id,cycle_id", ignoreDuplicates: true });

  if (insertErr) {
    return { count: 0, error: insertErr.message };
  }

  return { count: rows.length, error: null };
}

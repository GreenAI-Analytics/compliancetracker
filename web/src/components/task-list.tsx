"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

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
      name: string;
      display_order: number;
    } | null;
  } | null;
};

function formatTitle(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  const prev = parts.length > 1 ? parts[parts.length - 2] : last;
  const slug = last === "title" ? prev : last;
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = [
  "", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function formatDueRule(rule: string): string {
  // Parse key=value pairs, e.g. "month=1,day=31" or "iso-week=1,weekday=5"
  const parts = Object.fromEntries(
    rule.split(",").map((seg) => {
      const [k, v] = seg.trim().split("=");
      return [k.trim(), v?.trim() ?? ""];
    })
  );

  const month = parts["month"] ? parseInt(parts["month"], 10) : null;
  const day = parts["day"] ? parseInt(parts["day"], 10) : null;
  const isoWeek = parts["iso-week"] ? parseInt(parts["iso-week"], 10) : null;
  const weekday = parts["weekday"] ? parseInt(parts["weekday"], 10) : null;
  const quarter = parts["quarter"] ? parseInt(parts["quarter"], 10) : null;

  const monthName = month && MONTH_NAMES[month] ? MONTH_NAMES[month] : null;
  const weekdayName = weekday && WEEKDAY_NAMES[weekday] ? WEEKDAY_NAMES[weekday] : null;

  // "month=3,day=15" → "15 March"
  if (monthName && day) return `${day} ${monthName}`;

  // "day=31" (no month) → "31st of each month"
  if (day && !month) return `${day}${ordinal(day)} of each month`;

  // "iso-week=1,weekday=5" → "Week 1, Friday"
  if (isoWeek !== null && weekdayName) return `Week ${isoWeek}, ${weekdayName}`;

  // "weekday=5" → "Every Friday"
  if (weekdayName && !isoWeek) return `Every ${weekdayName}`;

  // "quarter=1,day=15" style
  if (quarter !== null && day) return `Day ${day} of Q${quarter}`;

  // Fallback: clean up underscores/dashes
  return rule.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function statusBadge(status: string, dueDate: string): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (status === "completed") return { label: "Complete", className: "bg-[#dff3e2] text-[#1b5e20]" };
  if (new Date(dueDate) < today) return { label: "Overdue", className: "bg-[#fde8df] text-[#b85c38]" };
  return { label: "Pending", className: "bg-[#eef6f0] text-[#446052]" };
}

export function TaskList({
  instanceUserId,
  tasks,
}: {
  instanceUserId: string;
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markComplete(instanceId: string) {
    setLoadingId(instanceId);
    setActionError(null);
    try {
      const res = await fetch("/api/task-instances/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to mark task as complete.");
      }

      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to mark task as complete.");
    } finally {
      setLoadingId(null);
    }
  }

  async function hideTask(taskId: string, organizationId?: string) {
    setLoadingId(taskId);
    setActionError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase client is not configured in this environment.");
      }
      // Get org id from user profile
      const { data: profile, error: profileError } = await supabase
        .from("onboarding_profiles")
        .select("organization_id")
        .eq("user_id", instanceUserId)
        .single();

      if (profileError) throw profileError;

      if (profile?.organization_id) {
        const { error: upsertError } = await supabase.from("hidden_items").upsert(
          {
            organization_id: profile.organization_id,
            hidden_by: instanceUserId,
            item_type: "task",
            item_ref: taskId,
          },
          { onConflict: "organization_id,item_type,item_ref" }
        );
        if (upsertError) throw upsertError;
      }
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to hide task.");
    } finally {
      setLoadingId(null);
    }
  }

  if (tasks.length === 0) return null;

  return (
    <div className="divide-y divide-[#e5eee7] rounded-xl border border-[#d7e5da] bg-white">
      {actionError && (
        <div className="border-b border-[#f3d2c5] bg-[#fff2ec] px-4 py-2 text-xs text-[#9f4b2a]">
          {actionError}
        </div>
      )}
      {tasks.map((row) => {
        const task = row.tasks;
        if (!task) return null;
        const title = formatTitle(task.title_key);
        const badge = statusBadge(row.status, row.due_date);
        const isLoading = loadingId === row.id || loadingId === task.task_id;

        return (
          <div key={row.id} className="flex items-start gap-4 px-4 py-3">
            {/* Completion checkbox */}
            <button
              aria-label={row.status === "completed" ? "Completed" : "Mark as complete"}
              disabled={row.status === "completed" || isLoading}
              onClick={() => markComplete(row.id)}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                row.status === "completed"
                  ? "border-[#2e7d32] bg-[#2e7d32] text-white"
                  : "border-[#afc6b5] hover:border-[#2e7d32]"
              } disabled:opacity-60`}
            >
              {row.status === "completed" && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    row.status === "completed" ? "line-through text-[#8da294]" : "text-[#173224]"
                  }`}
                >
                  {title}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[#5f7668]">Due {formatDate(row.due_date)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium capitalize text-[#355143]">
                  Priority: {row.priority}
                </span>
                <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium capitalize text-[#355143]">
                  {task.frequency.replace(/_/g, " ")}
                </span>
                {task.regulator && (
                  <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                    {task.regulator}
                  </span>
                )}
                {task.law_ref && (
                  <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                    {task.law_ref}
                  </span>
                )}
                {task.weekend_policy && (
                  <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium capitalize text-[#355143]">
                    Weekend: {task.weekend_policy.replace(/_/g, " ")}
                  </span>
                )}
                <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                  Evidence: {task.evidence_required ? "Required" : "Optional"}
                </span>
                {task.due_rule && (
                  <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                    Due: {formatDueRule(task.due_rule)}
                  </span>
                )}
                {task.rrule && (
                  <span className="rounded-full border border-[#d7e5da] bg-[#f3f8f4] px-2 py-0.5 text-[11px] font-medium text-[#355143]">
                    RRULE: {task.rrule}
                  </span>
                )}
              </div>
            </div>

            {/* Hide button */}
            {row.status !== "completed" && (
              <button
                aria-label="Hide task"
                disabled={isLoading}
                onClick={() => hideTask(task.task_id)}
                className="shrink-0 rounded p-1 text-xs text-[#7c9387] transition hover:bg-[#edf5ef] hover:text-[#1f4e33] disabled:opacity-40"
                title="Hide this task"
              >
                Hide
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

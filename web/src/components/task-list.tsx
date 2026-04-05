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

function statusBadge(status: string, dueDate: string): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (status === "completed") return { label: "Complete", className: "bg-[#d8f5e9] text-[#1a6b4a]" };
  if (new Date(dueDate) < today) return { label: "Overdue", className: "bg-[#fde8df] text-[#b85c38]" };
  return { label: "Pending", className: "bg-[#f0eee5] text-[#5a655f]" };
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
    <div className="divide-y divide-[#ece7da] rounded-xl border border-[#d6cfbc] bg-[#fffef9]">
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
                  ? "border-[#0d8f63] bg-[#0d8f63] text-white"
                  : "border-[#b5c2ba] hover:border-[#0d8f63]"
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
                    row.status === "completed" ? "line-through text-[#8a9a8f]" : "text-[#1a2e22]"
                  }`}
                >
                  {title}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-[#7a8880]">
                <span>Due {formatDate(row.due_date)}</span>
                <span className="capitalize">{task.frequency.replace(/_/g, " ")}</span>
                {task.regulator && <span>{task.regulator}</span>}
                {task.law_ref && <span className="italic">{task.law_ref}</span>}
              </div>
            </div>

            {/* Hide button */}
            {row.status !== "completed" && (
              <button
                aria-label="Hide task"
                disabled={isLoading}
                onClick={() => hideTask(task.task_id)}
                className="shrink-0 rounded p-1 text-xs text-[#9aaa9f] transition hover:bg-[#f5f0e8] hover:text-[#3b4a3f] disabled:opacity-40"
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

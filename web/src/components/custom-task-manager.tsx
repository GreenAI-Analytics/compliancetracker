"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RECURRING_INTERVALS = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bi-monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annually", label: "Semi-annually" },
  { value: "annually", label: "Annually" },
];

export function CustomTaskManager({
  disabled,
}: {
  disabled?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [priority, setPriority] = useState("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Task name is required.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings/custom-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || null,
          isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
          priority,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create custom task.");
      }

      setTitle("");
      setDueDate("");
      setIsRecurring(false);
      setRecurringInterval("monthly");
      setPriority("medium");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create custom task.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d7e5da] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto] md:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#5f7668]">Task name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled || isSaving}
              placeholder="e.g. Internal Policy Review"
              className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#5f7668]">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={disabled || isSaving}
              className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#5f7668]">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={disabled || isSaving}
              className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={disabled || isSaving}
            className="rounded-lg bg-[#2e7d32] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1b5e20] disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Add Task"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[#355143]">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              disabled={disabled || isSaving}
              className="h-4 w-4 rounded border-[#b6ceb8] text-[#2e7d32] focus:ring-[#2e7d32]"
            />
            Recurring task
          </label>

          {isRecurring && (
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#5f7668]">Interval</span>
              <select
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(e.target.value)}
                disabled={disabled || isSaving}
                className="rounded-lg border border-[#cfe0d3] bg-white px-3 py-1.5 text-sm text-[#173224] outline-none focus:border-[#2e7d32]"
              >
                {RECURRING_INTERVALS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

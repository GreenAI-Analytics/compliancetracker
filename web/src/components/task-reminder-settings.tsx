"use client";

import { useState } from "react";

type Props = {
  initialEnabled: boolean;
  initialDaysBefore: number;
};

const DAY_OPTIONS = [1, 3, 7, 14, 30];

export function TaskReminderSettings({ initialEnabled, initialDaysBefore }: Props) {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [daysBefore, setDaysBefore] = useState<number>(initialDaysBefore);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const res = await fetch("/api/settings/task-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, daysBefore }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save reminder settings.");
      }

      setSavedMessage("Reminder settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reminder settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <div className="rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="rounded-lg border border-[#cde6d3] bg-[#edf7ef] px-3 py-2 text-xs text-[#256338]">
          {savedMessage}
        </div>
      )}

      <div className="rounded-lg border border-[#d7e5da] bg-white p-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#173224]">Enable task reminders</p>
            <p className="text-xs text-[#5f7668]">Get reminded before compliance due dates.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              enabled ? "bg-[#2e7d32]" : "bg-[#c9d9cc]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#d7e5da] bg-white p-3">
        <label className="text-sm font-medium text-[#173224]" htmlFor="reminder-days-before">
          Remind me this many days before due date
        </label>
        <select
          id="reminder-days-before"
          disabled={!enabled}
          value={daysBefore}
          onChange={(e) => setDaysBefore(parseInt(e.target.value, 10))}
          className="mt-2 w-full rounded-md border border-[#c8d8cc] bg-white px-3 py-2 text-sm text-[#173224] outline-none focus:border-[#2e7d32] disabled:cursor-not-allowed disabled:bg-[#f3f5f3]"
        >
          {DAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day} day{day === 1 ? "" : "s"} before
            </option>
          ))}
        </select>
      </div>

      <div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#25672a] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Reminder Settings"}
        </button>
      </div>
    </div>
  );
}

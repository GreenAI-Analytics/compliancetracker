"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type HiddenTaskItem = {
  ref: string;
  title: string;
};

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function HiddenTasksManager({
  initialItems,
}: {
  initialItems: HiddenTaskItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<HiddenTaskItem[]>(initialItems);
  const [loadingRef, setLoadingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unhide(taskRef: string) {
    setLoadingRef(taskRef);
    setError(null);
    try {
      const res = await fetch("/api/settings/hidden-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskRef }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to unhide task.");
      }

      setItems((prev) => prev.filter((i) => i.ref !== taskRef));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unhide task.");
    } finally {
      setLoadingRef(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-3 text-sm text-[#6b8073]">No hidden tasks.</p>
    );
  }

  return (
    <div className="mt-3">
      {error && (
        <div className="mb-3 rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
          {error}
        </div>
      )}
      <ul className="divide-y divide-[#e4eee6] rounded-xl border border-[#d7e5da] bg-white">
        {items.map((item) => (
          <li key={item.ref} className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="truncate text-sm font-medium text-[#173224]">{item.title}</p>
            <button
              onClick={() => unhide(item.ref)}
              disabled={loadingRef === item.ref}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d7e5da] bg-white px-3 py-1.5 text-xs font-medium text-[#2e7d32] transition hover:bg-[#edf5ef] disabled:opacity-50"
            >
              <EyeIcon />
              {loadingRef === item.ref ? "Restoring…" : "Unhide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

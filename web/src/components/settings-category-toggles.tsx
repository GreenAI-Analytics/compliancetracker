"use client";

import { useState } from "react";

type CategoryToggleItem = {
  ref: string;
  name: string;
  enabled: boolean;
};

export function SettingsCategoryToggles({
  initialItems,
}: {
  initialItems: CategoryToggleItem[];
}) {
  const [items, setItems] = useState<CategoryToggleItem[]>(initialItems);
  const [savingRef, setSavingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleCategory(ref: string, enabled: boolean) {
    setSavingRef(ref);
    setError(null);

    const prev = items;
    setItems((current) =>
      current.map((item) => (item.ref === ref ? { ...item, enabled } : item))
    );

    try {
      const res = await fetch("/api/settings/category-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryRef: ref, enabled }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update category visibility.");
      }
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : "Failed to update category visibility.");
    } finally {
      setSavingRef(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-sm text-[#6b8073]">
        No categories found for your current country and NACE profile.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-3 rounded-lg border border-[#f3d2c5] bg-[#fff2ec] px-3 py-2 text-xs text-[#9f4b2a]">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {items.map((item) => {
          const isSaving = savingRef === item.ref;
          return (
            <li
              key={item.ref}
              className="flex items-center justify-between rounded-lg border border-[#d7e5da] bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-[#173224]">{item.name}</p>
                <p className="text-xs text-[#5f7668]">{item.enabled ? "Visible" : "Hidden"}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                disabled={isSaving}
                onClick={() => toggleCategory(item.ref, !item.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  item.enabled ? "bg-[#2e7d32]" : "bg-[#c9d9cc]"
                } disabled:opacity-60`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    item.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

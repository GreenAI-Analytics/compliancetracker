"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────

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

type EvidenceAttachment = {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  verified: boolean | null;
  downloadUrl: string | null;
};

type EvidenceState = {
  showUploader: boolean;
  selectedFile: File | null;
  notes: string;
  uploading: boolean;
  uploadProgress: number;
  existingEvidence: EvidenceAttachment[];
  loadingEvidence: boolean;
  error: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTitle(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  const prev = parts.length > 1 ? parts[parts.length - 2] : last;
  const slug = last === "title" ? prev : last;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatDueRule(rule: string): string {
  let normalizedRule = rule.trim();

  // Some source values are duplicated (e.g. "Month End+14dMonth End+14d").
  if (normalizedRule.length % 2 === 0) {
    const half = normalizedRule.length / 2;
    const first = normalizedRule.slice(0, half);
    const second = normalizedRule.slice(half);
    if (first === second) {
      normalizedRule = first;
    }
  }

  const compactRule = normalizedRule.toLowerCase().replace(/[\s_-]+/g, "");
  const fyeMatch = compactRule.match(/fye\+(\d+)m/);
  if (fyeMatch) {
    const months = parseInt(fyeMatch[1], 10);
    return `${months} month${months === 1 ? "" : "s"} after financial year end`;
  }

  const monthEndMatch = compactRule.match(/monthend\+(\d+)d/);
  if (monthEndMatch) {
    const days = parseInt(monthEndMatch[1], 10);
    return `${days} day${days === 1 ? "" : "s"} after month end`;
  }

  const quarterEndMatch = compactRule.match(/quarterend\+(\d+)d/);
  if (quarterEndMatch) {
    const days = parseInt(quarterEndMatch[1], 10);
    return `${days} day${days === 1 ? "" : "s"} after quarter end`;
  }

  // Parse key=value pairs, e.g. "month=1,day=31" or "iso-week=1,weekday=5"
  const parts = normalizedRule.includes("=")
    ? Object.fromEntries(
        normalizedRule.split(",").map((seg) => {
          const [k, v] = seg.trim().split("=");
          return [k.trim(), v?.trim() ?? ""];
        }),
      )
    : {};

  const month = parts["month"] ? parseInt(parts["month"], 10) : null;
  const day = parts["day"] ? parseInt(parts["day"], 10) : null;
  const isoWeek = parts["iso-week"] ? parseInt(parts["iso-week"], 10) : null;
  const weekday = parts["weekday"] ? parseInt(parts["weekday"], 10) : null;
  const quarter = parts["quarter"] ? parseInt(parts["quarter"], 10) : null;

  const monthName = month && MONTH_NAMES[month] ? MONTH_NAMES[month] : null;
  const weekdayName =
    weekday && WEEKDAY_NAMES[weekday] ? WEEKDAY_NAMES[weekday] : null;

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
  return normalizedRule
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function statusBadge(
  status: string,
  dueDate: string,
): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (status === "completed")
    return { label: "Complete", className: "bg-[#dff3e2] text-[#1b5e20]" };
  if (new Date(dueDate) < today)
    return { label: "Overdue", className: "bg-[#fde8df] text-[#b85c38]" };
  return { label: "Pending", className: "bg-[#eef6f0] text-[#446052]" };
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Evidence Upload Area Component ──────────────────────────────────────

function EvidenceUploadArea({
  selectedFile,
  notes,
  uploading,
  uploadProgress,
  error,
  onFileChange,
  onNotesChange,
  onUpload,
  onCancel,
}: {
  selectedFile: File | null;
  notes: string;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  onFileChange: (file: File | null) => void;
  onNotesChange: (notes: string) => void;
  onUpload: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      if (file) onFileChange(file);
    },
    [onFileChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="mt-3 rounded-lg border border-dashed border-[#a7c8af] bg-[#f6faf7] p-4">
      {!selectedFile ? (
        <div
          role="button"
          tabIndex={0}
          className={`flex cursor-pointer flex-col items-center justify-center py-4 text-center transition ${
            isDragOver ? "opacity-70" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Click or drag and drop to upload evidence file"
        >
          <svg
            className="mb-2 h-8 w-8 text-[#5f7668]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm font-medium text-[#355143]">
            Click to upload or drag and drop
          </p>
          <p className="mt-0.5 text-xs text-[#5f7668]">
            PDF, PNG, JPG, DOC — Max 5 MB
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#d7e5da] bg-white px-3 py-2 text-sm">
            <svg
              className="h-5 w-5 shrink-0 text-[#2e7d32]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="flex-1 truncate text-[#173224]">
              {selectedFile.name}
            </span>
            <span className="shrink-0 text-[#5f7668]">
              {formatFileSize(selectedFile.size)}
            </span>
            <button
              type="button"
              disabled={uploading}
              onClick={() => onFileChange(null)}
              className="shrink-0 text-[#b85c38] hover:text-[#9f4b2a] disabled:opacity-50"
              aria-label="Remove selected file"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <textarea
            placeholder="Optional notes about this evidence..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={uploading}
            rows={2}
            className="w-full resize-none rounded-lg border border-[#d7e5da] bg-white px-3 py-2 text-sm text-[#173224] placeholder-[#8da294] focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32] disabled:opacity-50"
          />

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#5f7668]">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#d7e5da]">
                <div
                  className="h-full rounded-full bg-[#2e7d32] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#b85c38]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={onUpload}
              className="min-h-9 rounded-lg border border-[#2e7d32] bg-[#2e7d32] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#245f26] disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload & Complete"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={onCancel}
              className="min-h-9 rounded-lg border border-[#c7d7ce] bg-white px-3 py-1.5 text-sm font-medium text-[#4d6357] transition hover:bg-[#edf5ef] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) onFileChange(file);
          // Reset input value so the same file can be re-selected
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Evidence Display Component ──────────────────────────────────────────

function EvidenceDisplay({
  evidence,
  loading,
  onRefresh,
}: {
  evidence: EvidenceAttachment[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-2 text-xs text-[#5f7668]">Loading evidence...</div>
    );
  }

  if (evidence.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-[#355143]">
        Evidence files ({evidence.length})
      </p>
      {evidence.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-2 rounded-md border border-[#d7e5da] bg-[#f6faf7] px-2.5 py-1.5 text-xs"
        >
          <svg
            className="h-4 w-4 shrink-0 text-[#2e7d32]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="flex-1 truncate text-[#173224]">{att.fileName}</span>
          {att.fileSize !== null && (
            <span className="shrink-0 text-[#5f7668]">
              {formatFileSize(att.fileSize)}
            </span>
          )}
          {att.downloadUrl ? (
            <a
              href={att.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded bg-[#2e7d32] px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-[#245f26]"
            >
              View
            </a>
          ) : (
            <span className="shrink-0 text-[#8da294]">Unavailable</span>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onRefresh}
        className="text-xs text-[#2e7d32] hover:underline"
      >
        Refresh
      </button>
    </div>
  );
}

// ─── Main Task List Component ────────────────────────────────────────────

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

  // Per-task evidence state keyed by task instance ID
  const [evidenceStates, setEvidenceStates] = useState<
    Record<string, EvidenceState>
  >({});

  function getEvidenceState(instanceId: string): EvidenceState {
    return (
      evidenceStates[instanceId] ?? {
        showUploader: false,
        selectedFile: null,
        notes: "",
        uploading: false,
        uploadProgress: 0,
        existingEvidence: [],
        loadingEvidence: false,
        error: null,
      }
    );
  }

  function setEvidenceState(
    instanceId: string,
    partial: Partial<EvidenceState>,
  ) {
    setEvidenceStates((prev) => ({
      ...prev,
      [instanceId]: { ...getEvidenceState(instanceId), ...partial },
    }));
  }

  async function fetchExistingEvidence(instanceId: string) {
    setEvidenceState(instanceId, { loadingEvidence: true });
    try {
      const res = await fetch(
        `/api/task-instances/evidence?taskInstanceId=${encodeURIComponent(instanceId)}`,
      );
      if (!res.ok) {
        setEvidenceState(instanceId, { loadingEvidence: false });
        return;
      }
      const body = (await res.json()) as { attachments: EvidenceAttachment[] };
      setEvidenceState(instanceId, {
        loadingEvidence: false,
        existingEvidence: body.attachments ?? [],
      });
    } catch {
      setEvidenceState(instanceId, { loadingEvidence: false });
    }
  }

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
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to mark task as complete.");
      }

      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to mark task as complete.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function uploadEvidenceAndComplete(instanceId: string) {
    const state = getEvidenceState(instanceId);
    if (!state.selectedFile) return;

    setEvidenceState(instanceId, {
      uploading: true,
      uploadProgress: 0,
      error: null,
    });
    setActionError(null);

    try {
      // Read file as base64
      const fileBuffer = await state.selectedFile.arrayBuffer();
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Simulate upload progress in 20% increments (actual progress tracking
      // would require a streaming upload — this gives user visual feedback)
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        simulatedProgress = Math.min(simulatedProgress + 20, 80);
        setEvidenceState(instanceId, { uploadProgress: simulatedProgress });
      }, 300);

      const res = await fetch("/api/task-instances/complete-with-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          fileName: state.selectedFile.name,
          fileType: state.selectedFile.type || "application/octet-stream",
          fileData: base64,
          notes: state.notes || undefined,
        }),
      });

      clearInterval(progressInterval);
      setEvidenceState(instanceId, { uploadProgress: 100 });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Failed to upload evidence and complete task.",
        );
      }

      // Small delay so the user sees 100% before the refresh
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.refresh();
    } catch (error) {
      setEvidenceState(instanceId, {
        uploading: false,
        uploadProgress: 0,
        error:
          error instanceof Error ? error.message : "Failed to upload evidence.",
      });
    }
  }

  function handleOpenUploader(instanceId: string) {
    setEvidenceState(instanceId, {
      showUploader: true,
      selectedFile: null,
      notes: "",
      uploadProgress: 0,
      error: null,
    });
  }

  function handleCancelUpload(instanceId: string) {
    setEvidenceState(instanceId, {
      showUploader: false,
      selectedFile: null,
      notes: "",
      uploadProgress: 0,
      error: null,
    });
  }

  async function hideTask(taskId: string) {
    setLoadingId(taskId);
    setActionError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error(
          "Supabase client is not configured in this environment.",
        );
      }
      // Get org id from user profile
      const { data: profile, error: profileError } = await supabase
        .from("onboarding_profiles")
        .select("organization_id")
        .eq("user_id", instanceUserId)
        .single();

      if (profileError) throw profileError;

      if (profile?.organization_id) {
        const { error: upsertError } = await supabase
          .from("hidden_items")
          .upsert(
            {
              organization_id: profile.organization_id,
              hidden_by: instanceUserId,
              item_type: "task",
              item_ref: taskId,
            },
            { onConflict: "organization_id,item_type,item_ref" },
          );
        if (upsertError) throw upsertError;
      }
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to hide task.",
      );
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
        const evState = getEvidenceState(row.id);

        return (
          <div key={row.id} className="px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    row.status === "completed"
                      ? "line-through text-[#8da294]"
                      : "text-[#173224]"
                  }`}
                >
                  {title}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[#5f7668]">
                Due {formatDate(row.due_date)}
              </div>
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

              <div className="mt-3 flex flex-wrap gap-2">
                {row.status !== "completed" ? (
                  task.evidence_required ? (
                    <>
                      {!evState.showUploader ? (
                        <button
                          aria-label="Upload evidence and complete"
                          disabled={isLoading}
                          onClick={() => handleOpenUploader(row.id)}
                          className="min-h-10 rounded-lg border border-[#2e7d32] bg-[#2e7d32] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#245f26] disabled:opacity-50"
                        >
                          {isLoading ? "Saving..." : "Upload Evidence"}
                        </button>
                      ) : (
                        <EvidenceUploadArea
                          selectedFile={evState.selectedFile}
                          notes={evState.notes}
                          uploading={evState.uploading}
                          uploadProgress={evState.uploadProgress}
                          error={evState.error}
                          onFileChange={(file) =>
                            setEvidenceState(row.id, {
                              selectedFile: file,
                              error: null,
                            })
                          }
                          onNotesChange={(notes) =>
                            setEvidenceState(row.id, { notes })
                          }
                          onUpload={() => uploadEvidenceAndComplete(row.id)}
                          onCancel={() => handleCancelUpload(row.id)}
                        />
                      )}
                    </>
                  ) : (
                    <button
                      aria-label="Mark task as complete"
                      disabled={isLoading}
                      onClick={() => markComplete(row.id)}
                      className="min-h-10 rounded-lg border border-[#2e7d32] bg-[#2e7d32] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#245f26] disabled:opacity-50"
                    >
                      {isLoading ? "Saving..." : "Mark Complete"}
                    </button>
                  )
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-10 items-center rounded-lg border border-[#a7c8af] bg-[#eaf5ed] px-3 py-2 text-sm font-medium text-[#1f5e2d]">
                      {task.evidence_required ? (
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Completed
                        </span>
                      ) : (
                        "Completed"
                      )}
                    </span>
                    {task.evidence_required && (
                      <button
                        type="button"
                        onClick={() => fetchExistingEvidence(row.id)}
                        className="min-h-10 rounded-lg border border-[#a7c8af] bg-white px-3 py-2 text-sm font-medium text-[#355143] transition hover:bg-[#edf5ef]"
                      >
                        View Evidence
                      </button>
                    )}
                  </div>
                )}

                {row.status !== "completed" && !evState.showUploader && (
                  <button
                    aria-label="Hide task"
                    disabled={isLoading}
                    onClick={() => hideTask(task.task_id)}
                    className="min-h-10 rounded-lg border border-[#c7d7ce] bg-white px-3 py-2 text-sm font-medium text-[#4d6357] transition hover:bg-[#edf5ef] disabled:opacity-50"
                    title="Hide this task"
                  >
                    Hide
                  </button>
                )}
              </div>

              {/* Show existing evidence for completed tasks when loaded */}
              {evState.loadingEvidence && (
                <EvidenceDisplay
                  evidence={[]}
                  loading={true}
                  onRefresh={() => fetchExistingEvidence(row.id)}
                />
              )}
              {evState.existingEvidence.length > 0 && (
                <EvidenceDisplay
                  evidence={evState.existingEvidence}
                  loading={false}
                  onRefresh={() => fetchExistingEvidence(row.id)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

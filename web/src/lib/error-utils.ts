import { captureError, captureMessage } from "@/lib/sentry";

/**
 * Logs an error to the console and sends it to Sentry (if configured).
 *
 * Use this as the primary error-capture function throughout the application.
 * It provides a consistent logging surface — every occurrence gets a
 * console.error **and** a Sentry event, ensuring nothing falls through the
 * cracks during development or production.
 *
 * @param context  - A human-readable label describing where the error occurred
 *                   (e.g. "POST /api/billing/webhook", "Dashboard.loadTasks").
 * @param error    - The thrown value (Error, string, or unknown).
 * @param metadata - Optional structured data to attach to the Sentry event
 *                   (e.g. { userId, orgId, requestId }).
 *
 * @example
 * ```ts
 * logError("sync-compliance-rules", error, { ruleId: "bg-esg-001" });
 * ```
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  // ── Console logging (always) ─────────────────────────────────────────
  const prefix = `[${context}]`;

  if (error instanceof Error) {
    console.error(`${prefix} ${error.message}`, {
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      ...metadata,
    });
  } else if (typeof error === "string") {
    console.error(`${prefix} ${error}`, metadata);
  } else {
    console.error(`${prefix} Unknown error type`, error, metadata);
  }

  // ── Sentry capture (when DSN is configured) ──────────────────────────
  const normalized = normalizeError(error);
  captureError(normalized, { context, ...metadata });
}

/**
 * Returns a safe, generic error message for external-facing responses while
 * **fully logging** the real error internally.
 *
 * Use this in API route handlers and server actions to avoid leaking
 * implementation details or sensitive data to the client. The real error is
 * always written to the console and sent to Sentry, so you retain full
 * observability.
 *
 * @param genericMessage - A user-safe message to return (e.g. "An unexpected
 *                         error occurred. Please try again.").
 * @param error          - The actual thrown value.
 * @param metadata       - Optional structured data for the internal log.
 * @returns The `genericMessage` string, suitable for a JSON response body or
 *          user-facing notification.
 *
 * @example
 * ```ts
 * // In an API route handler:
 * try {
 *   const data = await riskyOperation();
 *   return NextResponse.json(data);
 * } catch (error) {
 *   const message = sanitizeErrorMessage(
 *     "Failed to process your request.",
 *     error,
 *     { userId, operation: "riskyOperation" },
 *   );
 *   return NextResponse.json({ error: message }, { status: 500 });
 * }
 * ```
 */
export function sanitizeErrorMessage(
  genericMessage: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): string {
  logError("SanitizedError", error, metadata);
  return genericMessage;
}

/**
 * Wraps a promise-returning function with automatic error capture.
 *
 * If the wrapped function throws, the error is logged via `logError` and the
 * default value is returned instead. This is useful for non-critical
 * background operations where a failure should not propagate.
 *
 * @param fallback - Value to return when the operation fails.
 * @param context  - Context label for error logging.
 * @param fn       - Async function to execute.
 * @param metadata - Optional metadata attached to the error event.
 *
 * @example
 * ```ts
 * const articles = await withErrorFallback([], "loadKnowledgeArticles",
 *   () => fetchArticles(country, nace),
 *   { country, nace },
 * );
 * ```
 */
export async function withErrorFallback<T>(
  fallback: T,
  context: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(context, error, metadata);
    return fallback;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Coerces an unknown thrown value to an `Error` instance.
 *
 * - If it is already an `Error`, returns it as-is.
 * - If it is a string, wraps it in a `new Error(...)`.
 * - Otherwise, uses the string representation (e.g. `JSON.stringify`).
 */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error(
    `Non-Error thrown: ${String(error)}`,
  );
}

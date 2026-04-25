/**
 * Minimal Sentry integration using the direct HTTP Envelope API.
 *
 * Instead of pulling in the heavy `@sentry/nextjs` package, this module
 * sends error events to Sentry via its REST ingestion endpoint. Works in
 * both server and client contexts (browser `fetch` / Node 18+ global
 * `fetch`).
 *
 * Usage:
 * ```ts
 * import { captureError, captureMessage, initSentry } from "@/lib/sentry";
 *
 * initSentry();
 *
 * try {
 *   // …
 * } catch (error) {
 *   captureError(error instanceof Error ? error : new Error(String(error)));
 * }
 * ```
 *
 * Environment variables:
 *   SENTRY_DSN – The Sentry DSN (e.g.
 *     https://key@o123.ingest.sentry.io/456).
 *     When absent all functions silently no-op (development mode).
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type SentryLevel = "info" | "warning" | "error";

interface SentryEvent {
  event_id: string;
  level?: SentryLevel;
  timestamp?: number;
  logger?: string;
  message?: string | { formatted: string };
  exception?: {
    values: Array<{
      type: string;
      value: string;
      module?: string;
      stacktrace?: {
        frames: Array<{
          filename?: string;
          function?: string;
          lineno?: number;
          colno?: number;
          in_app?: boolean;
        }>;
      };
    }>;
  };
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  environment?: string;
  release?: string;
  server_name?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{
    timestamp?: number;
    message?: string;
    category?: string;
    level?: SentryLevel;
    data?: Record<string, unknown>;
  }>;
}

interface ParsedDsn {
  key: string;
  projectId: string;
  host: string;
}

// ─── State ───────────────────────────────────────────────────────────────

let dsn: string | null = null;
let parsed: ParsedDsn | null = null;
let initialized = false;
let environment = "development";
let release: string | undefined;

// ─── UUID v4 generator (no external deps) ────────────────────────────────

function generateUuid(): string {
  // crypto.randomUUID() is available in modern runtimes (Node 19+,
  // all major browsers). Fall back to Math.random() when unavailable.
  if (
    typeof crypto !== "undefined" &&
    typeof (crypto as { randomUUID?: () => string }).randomUUID === "function"
  ) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }

  // Fallback that produces valid UUID v4 strings.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── DSN parsing ─────────────────────────────────────────────────────────

/**
 * Parse a Sentry DSN string into its components.
 *
 * Format: https://<key>@o<org>.ingest.sentry.io/<project_id>
 *
 * Returns `null` if the DSN is missing or malformed.
 */
function parseDsn(raw: string): ParsedDsn | null {
  try {
    const url = new URL(raw);
    const key = url.username;
    const match = url.pathname.match(/^\/(\d+)/);
    if (!key || !match) {
      return null;
    }
    return {
      key,
      projectId: match[1],
      // Reconstruct the host without credentials.
      host: `${url.protocol}//${url.host}`,
    };
  } catch {
    return null;
  }
}

// ─── Envelope builder ────────────────────────────────────────────────────

/**
 * Build the Sentry Envelope body — a newline-delimited JSON (NDJSON) payload
 * that Sentry's ingestion API accepts.
 *
 * @see https://develop.sentry.dev/sdk/envelopes/
 */
function buildEnvelope(event: SentryEvent): string {
  const sentAt = new Date().toISOString();

  const envelopeHeaders = JSON.stringify({
    event_id: event.event_id,
    sent_at: sentAt,
    // Optional: dsn, sdk, etc.
  });

  const eventPayload = JSON.stringify(event);
  const eventHeaders = JSON.stringify({
    type: "event",
    content_type: "application/json",
    length: new TextEncoder().encode(eventPayload).length,
  });

  return `${envelopeHeaders}\n${eventHeaders}\n${eventPayload}`;
}

// ─── Envelope sender ─────────────────────────────────────────────────────

/**
 * POST an envelope to the Sentry ingestion endpoint.
 *
 * Silently swallows network / parse errors so that Sentry failures never
 * crash the calling code.
 */
async function sendEnvelope(event: SentryEvent): Promise<void> {
  if (!parsed) {
    return;
  }

  const endpoint = `${parsed.host}/api/${parsed.projectId}/envelope/`;
  const body = buildEnvelope(event);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_key=${parsed.key}`,
      },
      body,
    });

    if (!response.ok) {
      // Log at debug level only — we never want Sentry errors to be noisy.
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          "[sentry] Envelope rejected:",
          response.status,
          response.statusText,
        );
      }
    }
  } catch (err) {
    // Network errors are silently ignored in production.
    if (process.env.NODE_ENV !== "production") {
      console.debug("[sentry] Failed to send envelope:", err);
    }
  }
}

// ─── Event builders ──────────────────────────────────────────────────────

/**
 * Build a basic Sentry event from an Error object.
 */
function buildErrorEvent(
  error: Error,
  context?: Record<string, unknown>,
): SentryEvent {
  const eventId = generateUuid();

  // Parse stack trace into frames.
  const frames = parseStackFrames(error.stack);

  const event: SentryEvent = {
    event_id: eventId,
    level: "error",
    timestamp: Date.now() / 1000,
    logger: "client",
    exception: {
      values: [
        {
          type: error.name || "Error",
          value: error.message || String(error),
          stacktrace: frames.length > 0 ? { frames } : undefined,
        },
      ],
    },
    environment,
    release,
  };

  if (context && Object.keys(context).length > 0) {
    event.extra = context;
  }

  return event;
}

/**
 * Build a basic Sentry event from a message string.
 */
function buildMessageEvent(message: string, level: SentryLevel): SentryEvent {
  const eventId = generateUuid();

  return {
    event_id: eventId,
    level,
    timestamp: Date.now() / 1000,
    logger: "client",
    message: { formatted: message },
    environment,
    release,
  };
}

// ─── Stack frame parser ─────────────────────────────────────────────────

/**
 * Extract stack frames from an Error stack string.
 *
 * Handles both V8 (Chrome / Node) and Firefox formats:
 *   at functionName (file:line:col)
 *   @file:line:col
 */
/** A single parsed stack frame. */
interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

function parseStackFrames(stack?: string): StackFrame[] {
  if (!stack) {
    return [];
  }

  const lines = stack.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip the error message line ("Error: something").
    if (!trimmed || trimmed.startsWith("Error") || trimmed.startsWith("[")) {
      continue;
    }

    // V8: "at functionName (file:line:col)" or "at file:line:col"
    const v8Match = trimmed.match(
      /^at (?:(.+?)\s+\()?(.+?)(?::(\d+))?(?::(\d+))?\)?$/,
    );
    if (v8Match) {
      frames.push({
        filename: v8Match[2] || undefined,
        function: v8Match[1] || undefined,
        lineno: v8Match[3] ? parseInt(v8Match[3], 10) : undefined,
        colno: v8Match[4] ? parseInt(v8Match[4], 10) : undefined,
        in_app: isInApp(v8Match[2] || ""),
      });
      continue;
    }

    // Firefox: "@file:line:col"
    const ffMatch = trimmed.match(/^@(.+?)(?::(\d+))?(?::(\d+))?$/);
    if (ffMatch) {
      frames.push({
        filename: ffMatch[1] || undefined,
        lineno: ffMatch[2] ? parseInt(ffMatch[2], 10) : undefined,
        colno: ffMatch[3] ? parseInt(ffMatch[3], 10) : undefined,
        in_app: isInApp(ffMatch[1] || ""),
      });
    }
  }

  return frames.reverse(); // Sentry expects bottom-first ordering.
}

/**
 * Heuristic: frames in node_modules or the Next.js polyfill / webpack layer
 * are likely not "in-app" code.
 */
function isInApp(filename: string): boolean {
  return (
    !filename.includes("node_modules") &&
    !filename.includes("webpack") &&
    !filename.includes("_next/static/chunks") &&
    !filename.startsWith("internal/") &&
    !filename.startsWith("native ")
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────

/**
 * The configured Sentry DSN, or `null` if none was provided.
 *
 * Useful for consumers that want to check whether Sentry is active without
 * importing the full sentry module or calling `initSentry`.
 */
export { dsn as SENTRY_DSN };

/**
 * Initialise the Sentry integration.
 *
 * Reads the `SENTRY_DSN` environment variable and parses it. Call this once
 * at application startup (e.g. in the root layout or a top-level
 * `instrumentation.ts` file).
 *
 * Accepts optional overrides for `environment` and `release`.
 */
export function initSentry(options?: {
  environment?: string;
  release?: string;
}): void {
  if (initialized) {
    return;
  }

  dsn = process.env.SENTRY_DSN ?? null;
  environment = options?.environment ?? process.env.NODE_ENV ?? "development";
  release = options?.release;

  if (dsn) {
    parsed = parseDsn(dsn);
    if (parsed) {
      initialized = true;
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[sentry] Initialised — project: ${parsed.projectId}, environment: ${environment}`,
        );
      }
    } else {
      console.warn("[sentry] SENTRY_DSN is set but could not be parsed.");
    }
  } else {
    // No DSN — silently no-op in development.
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[sentry] SENTRY_DSN not set — error monitoring is disabled.",
      );
    }
  }
}

/**
 * Capture an error and send it to Sentry.
 *
 * If Sentry is not configured (no DSN), this is a no-op.
 *
 * @param error   - The Error object (or any value — non-Errors are wrapped).
 * @param context - Optional extra key/value data to attach to the event.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized || !parsed) {
    return;
  }

  const normalized = error instanceof Error ? error : new Error(String(error));
  const event = buildErrorEvent(normalized, context);

  // Fire-and-forget — no await so we never block the caller.
  void sendEnvelope(event);
}

/**
 * Capture a text message to Sentry.
 *
 * Useful for logging significant application events (e.g. "User signup
 * failed due to duplicate email").
 *
 * @param message - The message text.
 * @param level   - Severity level (default: "info").
 */
export function captureMessage(
  message: string,
  level: SentryLevel = "info",
): void {
  if (!initialized || !parsed) {
    return;
  }

  const event = buildMessageEvent(message, level);
  void sendEnvelope(event);
}

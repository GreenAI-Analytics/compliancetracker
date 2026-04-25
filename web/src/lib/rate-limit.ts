import { NextRequest } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blockedUntil: number | null;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  blockDurationMs?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_CHECKS = 100;

export const DEFAULT_MAX_REQUESTS = 30;
export const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_BLOCK_DURATION_MS = 60_000; // 1 minute block

// ─── IP extraction (mirrors the admin login pattern) ─────────────────────

/**
 * Extract the client IP from a NextRequest by checking common proxy headers.
 * Falls back to "unknown" when neither header is present.
 */
export function extractIp(request: NextRequest): string {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

// ─── RateLimiter class ────────────────────────────────────────────────────

/**
 * An in-memory sliding-window rate limiter.
 *
 * Stores entries in a `Map` keyed by an arbitrary identifier (user ID, IP,
 * email+IP pair, etc.). Old entries are cleaned up periodically to prevent
 * unbounded memory growth.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter({ maxRequests: 10, windowMs: 30_000 });
 *
 * const { allowed, retryAfterSeconds } = limiter.check(user.id);
 * if (!allowed) {
 *   return NextResponse.json(
 *     { error: "Too many requests" },
 *     { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
 *   );
 * }
 * ```
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;
  private blockDurationMs: number;
  private checkCounter = 0;

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.blockDurationMs =
      options?.blockDurationMs ?? DEFAULT_BLOCK_DURATION_MS;
  }

  /**
   * Check whether `identifier` is allowed to proceed.
   *
   * - If the current window has expired, the counter is reset.
   * - If the counter exceeds `maxRequests`, the identifier is blocked for
   *   `blockDurationMs`.
   * - Returns `{ allowed: true }` or
   *   `{ allowed: false, retryAfterSeconds: number }`.
   */
  check(identifier: string): RateLimitResult {
    // Periodic old-entry cleanup to avoid memory leaks.
    this.checkCounter++;
    if (this.checkCounter % CLEANUP_INTERVAL_CHECKS === 0) {
      this.cleanup();
    }

    const now = Date.now();
    let entry = this.store.get(identifier);

    if (!entry) {
      entry = { count: 0, windowStart: now, blockedUntil: null };
      this.store.set(identifier, entry);
    }

    // Still inside a block period → deny.
    if (entry.blockedUntil !== null && now < entry.blockedUntil) {
      const retryAfterSeconds = Math.ceil(
        (entry.blockedUntil - now) / 1000,
      );
      return { allowed: false, retryAfterSeconds };
    }

    // Window has expired → reset.
    if (now - entry.windowStart >= this.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
      entry.blockedUntil = null;
    }

    entry.count++;

    // Threshold crossed → start a block.
    if (entry.count > this.maxRequests) {
      entry.blockedUntil = now + this.blockDurationMs;
      const retryAfterSeconds = Math.ceil(this.blockDurationMs / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  }

  /**
   * Remove stale entries where:
   * - the window has expired and the entry is not blocked, or
   * - the block period has ended.
   */
  private cleanup(): void {
    const now = Date.now();
    const threshold = now - this.windowMs;

    for (const [key, entry] of this.store) {
      const expiredAndNotBlocked =
        entry.windowStart < threshold && entry.blockedUntil === null;
      const blockExpired =
        entry.blockedUntil !== null && entry.blockedUntil < now;

      if (expiredAndNotBlocked || blockExpired) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Remove the rate-limit state for a specific identifier.
   * Useful after a successful login or action to clear the penalty.
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /** Number of entries currently tracked (useful for diagnostics / health). */
  get size(): number {
    return this.store.size;
  }
}

// ─── Singleton + middleware helper ───────────────────────────────────────

const defaultLimiter = new RateLimiter();

/**
 * Convenience function that uses a module-level singleton `RateLimiter`.
 *
 * Pass `options` to create a **one-off** limiter with different thresholds;
 * omit them to reuse the shared instance (saves allocations and shares state).
 *
 * @example
 * ```ts
 * import { rateLimitMiddleware } from "@/lib/rate-limit";
 *
 * const check = rateLimitMiddleware(user.id);
 * if (!check.allowed) { /* 429 response * / }
 * ```
 */
export function rateLimitMiddleware(
  identifier: string,
  options?: { maxRequests?: number; windowMs?: number },
): RateLimitResult {
  if (options?.maxRequests !== undefined || options?.windowMs !== undefined) {
    // One-off limiter so we don't mutate the singleton's defaults.
    const limiter = new RateLimiter(options);
    return limiter.check(identifier);
  }
  return defaultLimiter.check(identifier);
}

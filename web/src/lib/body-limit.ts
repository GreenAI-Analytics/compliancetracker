/**
 * Request body size limit utilities for Next.js API routes.
 *
 * Provides helpers to check and parse request bodies against a configurable
 * byte limit. All byte measurements use `TextEncoder` for accurate UTF-8
 * sizing, matching the HTTP `content-length` convention.
 */

/** Default maximum body size: 100 KB (100 × 1024 bytes). */
export const DEFAULT_MAX_BODY_SIZE = 1024 * 100;

/**
 * Returns the byte size of a request body.
 *
 * Uses the `content-length` header when present (zero-copy). Falls back to
 * reading the body via a clone so the original request is not consumed.
 *
 * @param request - The incoming `Request` (works in Next.js App Router route handlers).
 * @returns The body size in bytes.
 */
export async function getBodySize(request: Request): Promise<number> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    return parseInt(contentLength, 10);
  }

  // Clone to avoid consuming the original request stream.
  const cloned = request.clone();
  const text = await cloned.text();
  return new TextEncoder().encode(text).length;
}

/**
 * Checks whether a request body exceeds the allowed byte limit.
 *
 * This is a lightweight, non‑destructive check — it will **not** consume
 * the original request body when `content-length` is set (the common case).
 * When the header is missing it clones the request internally.
 *
 * @param request  - The incoming `Request`.
 * @param maxBytes - Maximum allowed bytes (defaults to `DEFAULT_MAX_BODY_SIZE`).
 * @returns An object with `ok: true`, or `ok: false` plus a descriptive `error`.
 */
export async function checkBodySize(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_SIZE,
): Promise<{ ok: boolean; error?: string }> {
  const size = await getBodySize(request);

  if (size > maxBytes) {
    return {
      ok: false,
      error: `Request body exceeds the ${maxBytes} byte limit (received ${size} bytes)`,
    };
  }

  return { ok: true };
}

/**
 * Safely reads, validates, and parses a JSON request body.
 *
 * Combines a size check and JSON parse into one call, returning a
 * consistent result shape so route handlers can avoid repetitive
 * boilerplate.
 *
 * **Note:** This method **consumes** the request body (via `request.text()`).
 * Call it at most once per request — do not call `checkBodySize` first.
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const { data, error, status } = await parseBody<{ name: string }>(request);
 *   if (error) {
 *     return NextResponse.json({ error }, { status });
 *   }
 *   // data is now typed and safe to use
 * }
 * ```
 *
 * @param request  - The incoming `Request`.
 * @param maxBytes - Maximum allowed bytes (defaults to `DEFAULT_MAX_BODY_SIZE`).
 * @returns An object with typed `data` on success, or `error` / `status` on failure.
 */
export async function parseBody<T>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_SIZE,
): Promise<{ data?: T; error?: string; status?: number }> {
  // Fast path: reject early when content-length exceeds the limit.
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const size = parseInt(contentLength, 10);
    if (size > maxBytes) {
      return {
        error: `Request body exceeds the ${maxBytes} byte limit (received ${size} bytes)`,
        status: 413,
      };
    }
  }

  // Read the body (this consumes the stream).
  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      error: 'Failed to read request body',
      status: 400,
    };
  }

  // Double-check actual byte size (content-length can be absent or inaccurate).
  const byteSize = new TextEncoder().encode(text).length;
  if (byteSize > maxBytes) {
    return {
      error: `Request body exceeds the ${maxBytes} byte limit (received ${byteSize} bytes)`,
      status: 413,
    };
  }

  if (!text) {
    return {
      error: 'Request body is empty',
      status: 400,
    };
  }

  // Parse JSON.
  try {
    const data = JSON.parse(text) as T;
    return { data };
  } catch {
    return {
      error: 'Invalid JSON in request body',
      status: 400,
    };
  }
}

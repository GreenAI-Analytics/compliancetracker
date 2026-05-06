import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Name of the CSRF protection cookie.
 * Uses the double-submit cookie pattern: the cookie is readable by JavaScript
 * so the client can include it in the `X-CSRF-Token` header on state-changing
 * requests. An attacker on a different origin cannot read our cookies, so this
 * is secure against CSRF.
 */
export const CSRF_COOKIE_NAME = "csrf_token";

const COOKIE_CONFIG = {
  httpOnly: false, // Must be readable by JS for double-submit cookie pattern
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Generates a new CSRF token, sets it as a cookie on the response,
 * and returns the token value.
 */
export function setCsrfCookie(response: NextResponse): string {
  const token = crypto.randomUUID();
  response.cookies.set(CSRF_COOKIE_NAME, token, COOKIE_CONFIG);
  return token;
}

/**
 * Reads the CSRF token from the browser's cookies.
 * Use this in client components before making fetch() calls to mutation endpoints.
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Drop-in replacement for the global `fetch` that automatically includes the
 * `X-CSRF-Token` header on state-changing requests (POST, PUT, PATCH, DELETE).
 * Safe methods (GET, HEAD, OPTIONS) are passed through unchanged.
 */
export function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return fetch(input, init);
  }
  const token = getCsrfToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("X-CSRF-Token", token);
  }
  return fetch(input, { ...init, headers });
}

/**
 * Validates the CSRF token on an incoming request.
 *
 * Safe methods (GET, HEAD, OPTIONS) are always accepted without a token check.
 * For state-changing methods (POST, PUT, PATCH, DELETE) the `X-CSRF-Token`
 * header must match the value stored in the `csrf_token` cookie.
 *
 * Comparison uses `crypto.timingSafeEqual` to prevent timing attacks.
 */
export function validateCsrfToken(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  if (SAFE_METHODS.has(request.method)) {
    return { valid: true };
  }

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? null;

  if (!headerToken) {
    return { valid: false, error: "Missing X-CSRF-Token header" };
  }

  if (!cookieToken) {
    return { valid: false, error: "Missing CSRF token cookie" };
  }

  const headerBuf = Buffer.from(headerToken, "utf8");
  const cookieBuf = Buffer.from(cookieToken, "utf8");

  if (headerBuf.length !== cookieBuf.length) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  if (!crypto.timingSafeEqual(headerBuf, cookieBuf)) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  return { valid: true };
}

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Name of the CSRF protection cookie.
 * Stored as an HTTP-only cookie and checked on state-changing requests.
 */
export const CSRF_COOKIE_NAME = "csrf_token";

const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Generates a new CSRF token, sets it as an HTTP-only cookie on the response,
 * and returns the token value so callers can embed it in a `<meta>` tag,
 * a hidden form field, or the page's JSON data for the frontend to include
 * in the `X-CSRF-Token` header.
 *
 * @param response - A NextResponse instance to attach the cookie to.
 * @returns The newly generated CSRF token (plain text).
 */
export function setCsrfCookie(response: NextResponse): string {
  const token = crypto.randomUUID();
  response.cookies.set(CSRF_COOKIE_NAME, token, COOKIE_CONFIG);
  return token;
}

/**
 * Validates the CSRF token on an incoming request.
 *
 * **Safe methods** (GET, HEAD, OPTIONS) are always accepted without a token check.
 * For **state-changing methods** (POST, PUT, PATCH, DELETE) the `X-CSRF-Token`
 * header must match the value stored in the `csrf_token` cookie.
 *
 * Comparison uses `crypto.timingSafeEqual` to prevent timing attacks.
 *
 * @param request - The incoming NextRequest.
 * @returns An object with `valid` (boolean) and, if invalid, an `error` string.
 */
export function validateCsrfToken(
  request: NextRequest,
): { valid: boolean; error?: string } {
  // CSRF is only meaningful for state-changing requests
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

  // timingSafeEqual requires buffers of equal length
  if (headerBuf.length !== cookieBuf.length) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  if (!crypto.timingSafeEqual(headerBuf, cookieBuf)) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  return { valid: true };
}

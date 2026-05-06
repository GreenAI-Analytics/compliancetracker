import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/csrf";

/**
 * GET /api/csrf-token
 *
 * Sets the CSRF token cookie and returns it in the response body.
 * Clients call this before making their first state-changing request
 * so the cookie exists when csrfFetch() reads it.
 *
 * Safe to call multiple times — each call rotates the token.
 */
export async function GET() {
  const response = NextResponse.json({ ok: true });
  setCsrfCookie(response);
  return response;
}

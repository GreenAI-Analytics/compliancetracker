import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCredentials,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type LoginBody = {
  email?: string;
  password?: string;
};

type LoginRateLimitRow = {
  key: string;
  attempts: number;
  window_started_at: string;
  blocked_until: string | null;
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 30;

function getRateLimitKey(request: NextRequest, email: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";
  return `${email.toLowerCase()}|${ip}`;
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function POST(request: NextRequest) {
  const configured = getAdminCredentials();
  if (!configured) {
    return NextResponse.json(
      { error: "Admin credentials are not configured on the server." },
      { status: 500 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const rateLimitKey = getRateLimitKey(request, email);
  const admin = getSupabaseAdminClient();

  if (admin) {
    const { data: existingRateLimit } = await admin
      .from("admin_login_rate_limits")
      .select("key, attempts, window_started_at, blocked_until")
      .eq("key", rateLimitKey)
      .maybeSingle();

    const current = existingRateLimit as LoginRateLimitRow | null;
    const now = new Date();
    const windowStart = current?.window_started_at ? new Date(current.window_started_at) : now;
    const blockedUntil = current?.blocked_until ? new Date(current.blocked_until) : null;
    const windowActive = now.getTime() - windowStart.getTime() < WINDOW_MINUTES * 60 * 1000;

    if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
      );
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${Math.ceil(
            retryAfterSeconds / 60
          )} minute(s).`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    if (!windowActive && current) {
      await admin
        .from("admin_login_rate_limits")
        .upsert(
          {
            key: rateLimitKey,
            attempts: 0,
            window_started_at: now.toISOString(),
            blocked_until: null,
            updated_at: now.toISOString(),
          },
          { onConflict: "key" }
        );
    }
  }

  if (!verifyAdminCredentials(email, password)) {
    if (admin) {
      const now = new Date();
      const { data: currentRow } = await admin
        .from("admin_login_rate_limits")
        .select("key, attempts, window_started_at")
        .eq("key", rateLimitKey)
        .maybeSingle();

      const current = currentRow as
        | { key: string; attempts: number; window_started_at: string }
        | null;
      const windowStart = current?.window_started_at ? new Date(current.window_started_at) : now;
      const windowActive = now.getTime() - windowStart.getTime() < WINDOW_MINUTES * 60 * 1000;
      const attempts = (windowActive ? current?.attempts ?? 0 : 0) + 1;
      const blockedUntil = attempts >= MAX_ATTEMPTS ? minutesFromNow(BLOCK_MINUTES).toISOString() : null;

      await admin
        .from("admin_login_rate_limits")
        .upsert(
          {
            key: rateLimitKey,
            attempts,
            window_started_at: windowActive ? windowStart.toISOString() : now.toISOString(),
            blocked_until: blockedUntil,
            updated_at: now.toISOString(),
          },
          { onConflict: "key" }
        );
    }

    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  if (admin) {
    await admin.from("admin_login_rate_limits").delete().eq("key", rateLimitKey);
  }

  const token = createAdminSessionToken(email);
  if (!token) {
    return NextResponse.json(
      { error: "Admin session secret is missing or invalid." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}

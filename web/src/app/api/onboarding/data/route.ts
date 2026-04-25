import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";

const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours
};

export async function GET(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch the onboarding profile for this user
  // TODO: Switch to server client after RLS policies are implemented
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("onboarding_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch onboarding profile:", profileError);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
  }

  // 3. Generate a single CSRF token — included in the JSON body (for the
  //    client's X-CSRF-Token header) AND set as an HTTP-only cookie (for
  //    server-side validation).  This avoids calling `setCsrfCookie` which
  //    would generate a different token on each call.
  const csrfToken = crypto.randomUUID();

  const response = NextResponse.json({
    profile: profile ?? null,
    csrfToken,
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, COOKIE_CONFIG);

  return response;
}

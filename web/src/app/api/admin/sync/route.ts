import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const FUNCTION_NAMES = {
  knowledge: "sync-compliance-knowledge",
  rules: "sync-compliance-rules",
} as const;

type SyncTarget = keyof typeof FUNCTION_NAMES;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { target?: string };
  const target = body.target as SyncTarget | undefined;

  if (!target || !(target in FUNCTION_NAMES)) {
    return NextResponse.json({ error: "target must be 'knowledge' or 'rules'." }, { status: 400 });
  }

  const fnName = FUNCTION_NAMES[target];
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Function returned ${res.status}`, detail: json },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, result: json });
}

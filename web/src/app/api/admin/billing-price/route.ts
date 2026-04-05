import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const PRICE_KEY = "billing_monthly_price_eur";
const LEGACY_PRICE_KEY = "billing_monthly_price_usd";
const DEFAULT_PRICE = "9.99";

export async function GET() {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", PRICE_KEY)
    .single();

  if (data?.value) {
    return NextResponse.json({ price: data.value });
  }

  // Backward compatibility: read old USD key if EUR key has not been seeded yet.
  const { data: legacyData } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", LEGACY_PRICE_KEY)
    .single();

  return NextResponse.json({ price: legacyData?.value ?? DEFAULT_PRICE });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const body = (await request.json()) as { price?: string };
  const price = parseFloat(body.price ?? "");

  if (isNaN(price) || price < 0 || price > 100000) {
    return NextResponse.json({ error: "Valid price (0-100000) is required." }, { status: 400 });
  }

  const { error } = await supabase.from("admin_settings").upsert(
    { key: PRICE_KEY, value: String(price), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, price: price.toFixed(2) });
}

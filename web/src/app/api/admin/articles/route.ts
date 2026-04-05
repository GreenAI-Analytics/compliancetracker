import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id, article_id, title, country, category, is_active, last_updated")
    .order("country")
    .order("category")
    .order("title");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ articles: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const body = (await request.json()) as { articleId?: string; isActive?: boolean };
  const { articleId, isActive } = body;

  if (!articleId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "articleId and isActive are required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("knowledge_articles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("article_id", articleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

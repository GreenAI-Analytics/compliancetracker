import { NextResponse } from "next/server";
import { getNaceSectionCode, NACE_SECTIONS } from "@/lib/nace-sections";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type NaceOption = {
  code: string;
  section: string;
};

export async function GET() {
  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server configuration is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const { data, error } = await supabaseAdmin.from("rules").select("nace").limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueCodes = new Set<string>();
  for (const row of data ?? []) {
    const nace = String(row.nace ?? "");
    const code = nace.slice(0, 2);
    if (/^[0-9]{2}$/.test(code)) {
      uniqueCodes.add(code);
    }
  }

  const naceOptions: NaceOption[] = Array.from(uniqueCodes)
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((code) => ({
      code,
      section: getNaceSectionCode(code) ?? "",
    }));

  const usedSections = new Set(naceOptions.map((option) => option.section).filter((x) => x));
  const sections = NACE_SECTIONS.filter((section) => usedSections.has(section.code)).map((section) => ({
    code: section.code,
    name: section.name,
  }));

  return NextResponse.json({ sections, naceOptions });
}

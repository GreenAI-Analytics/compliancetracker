import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  CH: "Switzerland",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DE: "Germany",
  DK: "Denmark",
  EE: "Estonia",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HR: "Croatia",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MT: "Malta",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SE: "Sweden",
  SI: "Slovenia",
  SK: "Slovakia",
};

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("rules")
    .select("country")
    .order("country");

  if (error) {
    return NextResponse.json(
      { error: "Failed to load countries" },
      { status: 500 },
    );
  }

  // If no rules are synced yet, fall back to the full list of supported countries
  if (!data || data.length === 0) {
    const countries = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({
      code,
      name,
    }));
    return NextResponse.json({ countries });
  }

  const uniqueCodes = [
    ...new Set((data as { country: string }[]).map((r) => r.country)),
  ];

  const countries = uniqueCodes.map((code) => ({
    code,
    name: COUNTRY_NAMES[code] ?? code,
  }));

  return NextResponse.json({ countries });
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedUserTasks } from "@/lib/task-seeder";

type SignupBody = {
  authUserId: string;
  email: string;
  companyName: string;
  companyAddress: string;
  incorporationDate: string;
  country: string;
  naceCode: string;
};

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { authUserId, email, companyName, companyAddress, incorporationDate, country, naceCode } =
    body;

  if (!authUserId || !email || !companyName || !incorporationDate || !country || !naceCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the auth user actually exists in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Invalid auth user" }, { status: 400 });
  }

  // 1. Create organisation
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: companyName, country, nace: naceCode })
    .select("id")
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: `Failed to create organisation: ${orgError?.message}` },
      { status: 500 }
    );
  }

  // 2. Create user record
  const { error: userError } = await supabase.from("users").insert({
    id: authUserId,
    email,
    organization_id: org.id,
    role: "admin",
  });

  if (userError) {
    // Roll back the organisation if user insert fails
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json(
      { error: `Failed to create user record: ${userError.message}` },
      { status: 500 }
    );
  }

  // 3. Set organisation created_by
  await supabase.from("organizations").update({ created_by: authUserId }).eq("id", org.id);

  // 4. Create onboarding profile
  const signupDate = new Date();
  const trialEndsAt = new Date(signupDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: profileError } = await supabase.from("onboarding_profiles").insert({
    user_id: authUserId,
    organization_id: org.id,
    company_name: companyName,
    business_address: companyAddress || null,
    incorporation_date: incorporationDate,
    country,
    nace: naceCode,
    operating_countries: [country],
    modules_selected: [],
    onboarding_completed: false,
    signup_date: signupDate.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
  });

  if (profileError) {
    return NextResponse.json(
      { error: `Failed to create onboarding profile: ${profileError.message}` },
      { status: 500 }
    );
  }

  // 5. Seed task instances (best-effort; don't fail signup if this errors)
  await seedUserTasks(supabase, authUserId, org.id, country, naceCode);

  return NextResponse.json({ success: true, organizationId: org.id });
}

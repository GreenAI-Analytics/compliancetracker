export default function OnboardingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Onboarding Wizard</h1>
      <p className="mt-2 text-[#5c695f]">Step-based company setup for V1: country, profile, modules, team invites.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {["Step 1: Country", "Step 2: Company Profile", "Step 3: Modules", "Step 4: Team"].map((step) => (
          <div key={step} className="rounded-xl border border-[#d7cfbb] bg-[#fffef9] p-4">
            <h2 className="font-semibold">{step}</h2>
            <p className="mt-1 text-sm text-[#5d695f]">Implementation scaffold ready. Hook this to Supabase profile tables next.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

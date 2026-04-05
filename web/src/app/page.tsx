import Image from "next/image";
import Link from "next/link";

const highlights = [
  "Country + NACE-specific task checklists",
  "Knowledge guidance synced from your compliance content repos",
  "One place for deadlines, hidden sections, and custom categories",
];

const steps = [
  {
    title: "Set up your company",
    detail: "Choose your country, NACE code, and active modules during onboarding.",
  },
  {
    title: "Track what matters",
    detail: "See priority tasks, timelines, and calendar deadlines in one dashboard.",
  },
  {
    title: "Stay current",
    detail: "Nightly sync keeps rules and knowledge content aligned with GitHub.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen px-4 py-10 md:py-14">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-3xl border border-[#d9d2bf] bg-[#fffdf8] p-8 shadow-[0_20px_50px_rgba(29,42,36,0.1)] md:p-12">
          <Image
            src="/compliance-tracker-logo.png"
            alt="Compliance Tracker"
            width={360}
            height={96}
            className="h-auto w-[220px] md:w-[320px]"
            priority
          />
          <div className="pill inline-flex rounded-full px-3 py-1 text-xs">Built for EU SMEs</div>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
            Simplify compliance tracking without the legal noise.
          </h1>
          <p className="mt-5 max-w-2xl text-[#516058]">
            Compliance Track turns country and NACE-specific obligations into actionable checklists,
            deadlines, and knowledge guidance for your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-[var(--accent)] px-5 py-3 text-white hover:bg-[var(--accent-strong)]"
            >
              Start 30-Day Trial
            </Link>
            <Link href="/login?fresh=1" className="rounded-xl border border-[#cfc7b3] px-5 py-3 text-[#25312b] hover:bg-[#f3efe3]">
              Login
            </Link>
          </div>

          <div className="mt-10 grid gap-3">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl bg-[#f7f3ea] px-4 py-3 text-sm text-[#415048]">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9d2bf] bg-[#fcfbf6] p-6 shadow-[0_14px_30px_rgba(29,42,36,0.08)] md:p-8">
          <div className="pill inline-flex rounded-full px-3 py-1 text-xs">How it works</div>
          <div className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-[#e1d9c7] bg-white px-4 py-4">
                <div className="text-xs font-semibold tracking-[0.16em] text-[#0c7d58]">STEP 0{index + 1}</div>
                <h2 className="mt-2 text-lg font-bold">{step.title}</h2>
                <p className="mt-1 text-sm text-[#5a665f]">{step.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#15372d] p-5 text-[#eef8f3]">
            <div className="text-sm font-semibold">Start with sign up</div>
            <p className="mt-1 text-sm text-[#d5ece2]">
              The first local flow we are enabling is account creation with Supabase email/password auth.
            </p>
            <Link
              href="/login?mode=signup"
              className="mt-4 inline-flex rounded-lg bg-[#8de1b8] px-4 py-2 text-sm font-medium text-[#103126]"
            >
              Open sign up
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
